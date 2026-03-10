// /opt/project-bundler/src/bundler.ts

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { t } from './i18n';
import { TreeGenerator } from './treeGenerator';
import { TokenStats } from './tokenStats';

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

export async function generateBundle(
    rootPath: string,
    allFiles: vscode.Uri[],
    contentFiles: vscode.Uri[],
    smartTree: boolean,
    excludedFolderPaths: Set<string> = new Set(),  // NEW: folders excluded from scanning
    binaryFilePaths: Set<string> = new Set()       // NEW: binary files
): Promise<string> {

    const config = vscode.workspace.getConfiguration('projectBundler');
    const binaryExtensions = new Set(
        (config.get<string[]>('binaryExtensions', [])).map(e => e.toLowerCase())
    );
    const includeFileDate = config.get<boolean>('includeFileDate', true);
    const dateFormat = config.get<string>('dateFormat', 'DD.MM.YYYY');
    const timeFormat = config.get<string>('timeFormat', 'HH:mm:ss');
    const use12h = config.get<boolean>('timeFormat12h', false);

    // -----------------------------
    // 1. Сортировка файлов (стабильный порядок)
    // -----------------------------
    contentFiles.sort((a, b) =>
        a.fsPath.localeCompare(b.fsPath, undefined, { numeric: true, sensitivity: 'base' })
    );

    // -----------------------------
    // 2. Сборка секции с контентом
    // -----------------------------
    let contentSection = '';
    let processedCount = 0;
    let skippedCount = 0;

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

        contentSection += `--- FILE: ${relativePath} ---\n`;
        if (lastModified) {
            contentSection += `${t('lastModified')}: ${lastModified}\n`;
        }

        if (binaryExtensions.has(ext)) {
            contentSection += `[Binary or excluded extension: ${ext}]\n`;
            skippedCount++;
        } else {
            try {
                const content = await fs.readFile(fileUri.fsPath, 'utf8');
                if (content.includes('\0')) {
                    contentSection += `[Binary content detected — skipped]\n`;
                    skippedCount++;
                } else {
                    contentSection += content + (content.endsWith('\n') ? '' : '\n');
                    processedCount++;
                }
            } catch (err) {
                contentSection += `[Error reading file: ${String(err)}]\n`;
            }
        }
        contentSection += `--- END OF FILE: ${relativePath} ---\n\n`;
    }

    // -----------------------------
    // 3. Подготовка дерева
    // -----------------------------
    const allPaths = allFiles.map(f => path.relative(rootPath, f.fsPath));
    const selectedPaths = new Set(
        contentFiles.map(f => path.relative(rootPath, f.fsPath))
    );
    const treeGen = new TreeGenerator({
        rootPath,
        allFilePaths: allPaths,
        selectedPaths,
        excludedFolderPaths,  // NEW
        binaryFilePaths,      // NEW
        smartCompression: smartTree
    });
    const tree = treeGen.generate();
    
    // -----------------------------
    // 4. Черновой бандл (для подсчета статистики)
    // -----------------------------
    // Важно: Собираем без хедера, чтобы статистика была только по полезной нагрузке
    const draftBundle =
        tree +
        (tree ? `\n================================================================================\n` : '') +
        `${t('contents')} (${contentFiles.length} files)\n\n` +
        contentSection;

    const totalChars = draftBundle.length;
    const estTokens = TokenStats.estimate(draftBundle);

    // -----------------------------
    // 5. Финальный хедер (с точной статистикой)
    // -----------------------------
    let header = `PROJECT BUNDLE | ${path.basename(rootPath)}\n`;
    header += `${t('generated')}: ${new Date().toLocaleString()}\n`;

    // ИСПРАВЛЕНО: Теперь используем ключи перевода
    const modeText = smartTree
        ? t('modeSmart')
        : (selectedPaths.size === allPaths.length ? t('modeFull') : t('modeSelected'));

    header += `${t('mode')}: ${modeText}\n`;
    header += `Root: ${rootPath}\n`;
    header += `\n`;
    header += `${t('stats')}\n`;
    header += `  - ${t('filesCount')}: ${contentFiles.length} (${processedCount} text, ${skippedCount} skipped)\n`;
    header += `  - ${t('kb')}: ~${(totalChars / 1024).toFixed(1)} KB\n`;
    header += `  - ${t('tokens')}: ~${TokenStats.format(estTokens)}\n`;

    // -----------------------------
    // 6. Финальная сборка
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