// /opt/project-bundler/src/bundler.ts

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { t } from './i18n';
import { TreeGenerator } from './treeGenerator';
import { TokenStats } from './tokenStats';
import { JsonTransformerEngine } from './jsonTransformer';
import { DatabaseExtractor } from './dbExtractor';
import { DependencyGraph, ImportParser } from './dependencyGraph';

/**
 * Calculate total bundle length (for KB estimate)
 */
function draftBundleLength(contentSection: string, tree: string): number {
    return tree.length +
        (tree ? `\n================================================================================\n`.length : 0) +
        `${t('contents')} (${0} files)\n\n`.length +  // approximate
        contentSection.length;
}

/**
 * Format date according to user settings
 * Supported tokens: DD, MM, YYYY, HH, hh, mm, ss, a (AM/PM)
 */
function formatDate(date: Date, dateFormat: string, timeFormat: string, use12h: boolean): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const dateStr = dateFormat
        .replace('DD', pad(date.getDate()))
        .replace('MM', pad(date.getMonth() + 1))
        .replace('YYYY', date.getFullYear().toString());
    
    // Time formatting
    let hours = date.getHours();
    let ampm = '';
    
    if (use12h) {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12; // Convert 0 to 12, 13-23 to 1-11
    }
    
    let timeStr = timeFormat
        .replace('HH', pad(hours))
        .replace('hh', pad(hours))
        .replace('mm', pad(date.getMinutes()))
        .replace('ss', pad(date.getSeconds()));
    
    // Add AM/PM if 12h format and 'a' token present
    if (use12h && timeStr.includes('a')) {
        timeStr = timeStr.replace('a', ampm.trim());
    } else if (use12h) {
        timeStr += ampm;
    }
    
    // Combine date and time if both are provided
    if (timeFormat.trim()) {
        return `${dateStr} ${timeStr}`;
    }
    return dateStr;
}

/**
 * Sort files by dependency order
 * EA-04: Context-aware file ordering
 */
function sortByDependencies(files: vscode.Uri[], rootPath: string): vscode.Uri[] {
    const graph = new DependencyGraph();
    const fileMap = new Map<string, vscode.Uri>();

    // Add all files to graph
    for (const file of files) {
        const relativePath = path.relative(rootPath, file.fsPath);
        graph.addFile(file.fsPath, relativePath);
        fileMap.set(file.fsPath, file);

        // Mark entry points
        if (ImportParser.isEntryPoint(file.fsPath)) {
            graph.markAsEntryPoint(file.fsPath);
        }
    }

    // Parse imports from each file
    for (const file of files) {
        try {
            const content = fsSync.readFileSync(file.fsPath, 'utf8');
            const imports = ImportParser.parseImports(file.fsPath, content);

            // Try to resolve imports to actual files
            for (const imp of imports) {
                const resolved = resolveImport(file.fsPath, imp, rootPath);
                if (resolved && fileMap.has(resolved)) {
                    graph.addImport(file.fsPath, resolved);
                }
            }
        } catch (e) {
            // Ignore read errors
        }
    }

    // Get sorted order
    const sortedPaths = graph.getSortedFiles();

    // Convert back to URIs
    return sortedPaths
        .map(p => fileMap.get(p))
        .filter((u): u is vscode.Uri => u !== undefined);
}

/**
 * Resolve an import path to an actual file path
 */
function resolveImport(fromFile: string, importPath: string, rootPath: string): string | null {
    const fromDir = path.dirname(fromFile);

    // Relative import
    if (importPath.startsWith('.')) {
        const resolved = path.resolve(fromDir, importPath);

        // Try with extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.php', '.rb', '.java', '.cs'];
        for (const ext of extensions) {
            const withExt = resolved + ext;
            if (fsSync.existsSync(withExt)) {
                return withExt;
            }
        }

        // Try index files
        for (const ext of extensions) {
            const indexFile = path.join(resolved, `index${ext}`);
            if (fsSync.existsSync(indexFile)) {
                return indexFile;
            }
        }

        return resolved;
    }

    // Absolute or module import - try to find in project source directories
    const basename = path.basename(importPath);
    const sourceDirs = ['src', 'lib', 'app', 'src/main', 'src/lib', 'src/app', 'packages', 'modules'];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.php', '.rb', '.java', '.cs'];

    // Try common source directories first
    for (const srcDir of sourceDirs) {
        const dirPath = path.join(rootPath, srcDir);
        if (fsSync.existsSync(dirPath)) {
            // Try with extensions
            for (const ext of extensions) {
                const withExt = path.join(dirPath, basename + ext);
                if (fsSync.existsSync(withExt)) {
                    return withExt;
                }
                // Try with index
                const indexFile = path.join(dirPath, basename, `index${ext}`);
                if (fsSync.existsSync(indexFile)) {
                    return indexFile;
                }
            }
        }
    }

    // Fallback: search all files (but limit depth to avoid performance issues)
    try {
        const allFiles = fsSync.readdirSync(rootPath, { recursive: true, withFileTypes: true });
        for (const file of allFiles) {
            if (typeof file === 'object' && file !== null && 'isFile' in file && file.isFile()) {
                const fullPath = path.join(rootPath, 'path' in file ? (file.path as string) || '' : '', file.name);
                const fileBasename = path.basename(file.name, path.extname(file.name));
                if (fileBasename === basename) {
                    return fullPath;
                }
            }
        }
    } catch (e) {
        // Ignore errors
    }

    return null;
}

export async function generateBundle(
    rootPath: string,
    allFiles: vscode.Uri[],
    contentFiles: vscode.Uri[],
    smartTree: boolean,
    excludedFolderPaths: Set<string> = new Set(),  // NEW: folders excluded from scanning
    binaryFilePaths: Set<string> = new Set(),       // NEW: binary files
    preset?: string                                 // NEW: preset type for mode display
): Promise<string> {
    const bundleStart = Date.now();

    const config = vscode.workspace.getConfiguration('projectBundler');
    const binaryExtensions = new Set(
        (config.get<string[]>('binaryExtensions', [])).map(e => e.toLowerCase())
    );
    const includeFileDate = config.get<boolean>('includeFileDate', true);
    const dateFormat = config.get<string>('dateFormat', 'DD.MM.YYYY');
    const timeFormat = config.get<string>('timeFormat', 'HH:mm:ss');
    const use12h = config.get<boolean>('timeFormat12h', false);
    
    // Transformer settings
    const transformJson = config.get<boolean>('transformJsonFiles', true);
    const extractDbSchema = config.get<boolean>('extractDatabaseSchema', true);
    const useDependencyOrdering = config.get<boolean>('useDependencyOrdering', true);

    // Initialize transformers
    const jsonTransformer = transformJson ? new JsonTransformerEngine() : null;
    const dbExtractor = extractDbSchema ? new DatabaseExtractor() : null;
    const sqlMigrationFiles: vscode.Uri[] = [];
    const prismaFiles: vscode.Uri[] = [];

    // -----------------------------
    // 1. Сортировка файлов (стабильный порядок)
    // -----------------------------
    // EA-04: Context-aware file ordering
    // Enabled by default for better AI context understanding
    if (useDependencyOrdering) {
        contentFiles = sortByDependencies(contentFiles, rootPath);
    } else {
        contentFiles.sort((a, b) =>
            a.fsPath.localeCompare(b.fsPath, undefined, { numeric: true, sensitivity: 'base' })
        );
    }

    // -----------------------------
    // 2. PASS 1: Read files and count tokens per file
    // -----------------------------
    const pass1Start = Date.now();
    let contentSection = '';
    let processedCount = 0;
    let skippedCount = 0;
    
    // Store file data for dual-pass token counting
    interface FileData {
        uri: vscode.Uri;
        relativePath: string;
        content?: string;
        tokenCount: number;
        isSkipped: boolean;
        lastModified?: string;
    }
    
    const fileDataList: FileData[] = [];

    for (const fileUri of contentFiles) {
        const relativePath = path.relative(rootPath, fileUri.fsPath);
        const ext = path.extname(fileUri.fsPath).toLowerCase();

        // Get file modification date (if enabled)
        let lastModified: string | undefined;
        if (includeFileDate) {
            try {
                const stat = await fs.stat(fileUri.fsPath);
                lastModified = formatDate(stat.mtime, dateFormat, timeFormat, use12h);
            } catch (err) {
                lastModified = undefined;
            }
        }

        const fileData: FileData = {
            uri: fileUri,
            relativePath,
            tokenCount: 0,
            isSkipped: false,
            lastModified
        };

        if (binaryExtensions.has(ext)) {
            fileData.isSkipped = true;
            skippedCount++;
        } else {
            try {
                let content = await fs.readFile(fileUri.fsPath, 'utf8');
                
                if (content.includes('\0')) {
                    fileData.isSkipped = true;
                    skippedCount++;
                } else {
                    // Collect SQL migration files for database extraction
                    if (dbExtractor && dbExtractor.isMigrationFile(fileUri.fsPath)) {
                        sqlMigrationFiles.push(fileUri);
                    }

                    // Collect Prisma schema files
                    if (dbExtractor && path.basename(fileUri.fsPath).toLowerCase() === 'schema.prisma') {
                        prismaFiles.push(fileUri);
                    }

                    // Apply JSON transformer if applicable
                    if (jsonTransformer && jsonTransformer.canTransform(fileUri.fsPath)) {
                        const transformResult = jsonTransformer.transform(content, fileUri.fsPath);
                        content = transformResult.transformed;
                        fileData.tokenCount = transformResult.newTokens;
                    } else {
                        fileData.tokenCount = TokenStats.estimateForFile(content, ext);
                    }
                    
                    fileData.content = content;
                    processedCount++;
                }
            } catch (err) {
                fileData.isSkipped = true;
                skippedCount++;
            }
        }
        
        fileDataList.push(fileData);
    }

    // -----------------------------
    // 3. Build content section from stored data
    // -----------------------------
    for (const fileData of fileDataList) {
        contentSection += `--- FILE: ${fileData.relativePath} ---\n`;
        if (fileData.lastModified) {
            contentSection += `${t('lastModified')}: ${fileData.lastModified}\n`;
        }

        if (fileData.isSkipped || !fileData.content) {
            contentSection += `[Binary or excluded extension: ${path.extname(fileData.uri.fsPath).toLowerCase()}]\n`;
        } else {
            contentSection += fileData.content + (fileData.content.endsWith('\n') ? '' : '\n');
        }
        contentSection += `--- END OF FILE: ${fileData.relativePath} ---\n\n`;
    }

    // Calculate base file tokens (before DB extraction)
    let totalFileTokens = fileDataList.reduce((sum, fd) => sum + fd.tokenCount, 0);

    // -----------------------------
    // 3.5. Extract database schema from SQL migrations
    // -----------------------------
    if (dbExtractor && sqlMigrationFiles.length > 0) {
        const migrationPaths = sqlMigrationFiles.map(f => f.fsPath);
        const dbResult = await dbExtractor.extractFromMigrations(migrationPaths);

        if (dbResult.tables.length > 0) {
            contentSection += `--- FILE: [DATABASE SCHEMA FROM MIGRATIONS] ---\n`;
            contentSection += dbResult.transformed + '\n';
            contentSection += `--- END OF FILE: [DATABASE SCHEMA FROM MIGRATIONS] ---\n\n`;

            // Add database tokens to total
            totalFileTokens += dbResult.tokenCount;
        }
    }

    // -----------------------------
    // 3.6. Extract database schema from Prisma
    // -----------------------------
    if (dbExtractor && prismaFiles.length > 0) {
        for (const prismaFile of prismaFiles) {
            const dbResult = await dbExtractor.extractFromPrisma(prismaFile.fsPath);

            if (dbResult.tables.length > 0) {
                contentSection += `--- FILE: [DATABASE SCHEMA FROM PRISMA] ---\n`;
                contentSection += dbResult.transformed + '\n';
                contentSection += `--- END OF FILE: [DATABASE SCHEMA FROM PRISMA] ---\n\n`;

                // Add database tokens to total
                totalFileTokens += dbResult.tokenCount;
            }
        }
    }

    // -----------------------------
    // 4. Prepare tree with token counts
    // -----------------------------
    const allPaths = allFiles.map(f => path.relative(rootPath, f.fsPath));
    const selectedPaths = new Set(
        contentFiles.map(f => path.relative(rootPath, f.fsPath))
    );
    
    // Build map of file path -> token count for tree
    const fileTokenCounts = new Map<string, number>();
    for (const fileData of fileDataList) {
        if (!fileData.isSkipped) {
            fileTokenCounts.set(fileData.relativePath, fileData.tokenCount);
        }
    }
    
    const treeGen = new TreeGenerator({
        rootPath,
        allFilePaths: allPaths,
        selectedPaths,
        excludedFolderPaths,  // NEW
        binaryFilePaths,      // NEW
        smartCompression: smartTree,
        fileTokenCounts       // NEW: pass token counts to tree
    });
    const tree = treeGen.generate();

    // -----------------------------
    // 5. PASS 2: Calculate total tokens using dual-pass approach
    // -----------------------------
    // totalFileTokens already calculated above (including DB schema if extracted)

    // Add tokens for content markers (file separators, etc.)
    const markerTokens = TokenStats.estimateContentMarkers(contentFiles.length);
    
    // Add tokens for tree structure
    const treeTokens = TokenStats.estimateTree(tree);
    
    // Add header tokens (constant approximation)
    const headerTokens = TokenStats.estimateHeader();
    
    // Total tokens (dual-pass calculation)
    const estTokens = totalFileTokens + markerTokens + treeTokens + headerTokens;
    
    // Also calculate total chars for KB estimate
    const totalChars = draftBundleLength(contentSection, tree);

    // -----------------------------
    // 6. Финальный хедер (с точной статистикой, рассчитанной по dual-pass)
    // -----------------------------
    let header = `PROJECT BUNDLE | ${path.basename(rootPath)}\n`;
    header += `${t('generated')}: ${new Date().toLocaleString()}\n`;

    // ИСПРАВЛЕНО: Теперь используем ключи перевода с учётом пресетов
    let modeText: string;
    if (preset) {
        // Map preset enum values to i18n keys
        const presetToI18n: Record<string, string> = {
            'minimal': 'modePresetMinimal',
            'arch': 'modePresetArchitecture',
            'debug': 'modePresetDebug',
            'selected': 'modePresetSelected',
            'full': 'modePresetFull'
        };
        const i18nKey = presetToI18n[preset] || `modePreset${preset}`;
        modeText = t(i18nKey) || `${preset} Preset`;
    } else if (smartTree) {
        modeText = t('modeSmart');
    } else if (selectedPaths.size === allPaths.length) {
        modeText = t('modeFull');
    } else {
        modeText = t('modeSelected');
    }

    header += `${t('mode')}: ${modeText}\n`;
    header += `Root: ${rootPath}\n`;
    header += `\n`;
    header += `${t('stats')}\n`;
    header += `  - ${t('filesCount')}: ${contentFiles.length} (${processedCount} text, ${skippedCount} skipped)\n`;
    header += `  - ${t('kb')}: ~${(totalChars / 1024).toFixed(1)} KB\n`;
    header += `  - ${t('tokens')}: ~${TokenStats.format(estTokens)}\n`;

    // -----------------------------
    // 7. Финальная сборка
    // -----------------------------
    const finalBundle =
        header +
        `\n================================================================================\n` +
        `${t('structure')}\n` +
        `(${t('treeLegend')})\n\n` + // ИСПРАВЛЕНО: перевод легенды
        tree +
        `\n================================================================================\n` +
        `${t('contents')} (${contentFiles.length} files)\n\n` +
        contentSection;

    return finalBundle.trimEnd();
}