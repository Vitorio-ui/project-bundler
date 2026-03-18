import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';

export class IgnoreEngine {
    private ig = ignore();
    private rulesLoaded = false;

    // Folder patterns for fast exclusion check (before scanning)
    private excludedFolderPatterns: string[] = [];

    // Binary extensions set for quick lookup
    private binaryExtensions: Set<string> = new Set();

    // Option to include docs/ even if in .gitignore
    private includeDocsFromGitignore: boolean = false;

    // Option to use .bundlerignore file
    private useBundlerignore: boolean = true;

    constructor(private workspaceRoot: string) {}

    /**
     * Load all ignore rules from:
     * 1. projectBundler.excludeFolders -> excludedFolderPatterns (for fast folder check)
     * 2. projectBundler.binaryExtensions -> binaryExtensions set + added to ig as glob patterns
     * 3. projectBundler.userExcludes + projectBundler.customExcludes (backward compat) -> added to ig
     * 4. All .gitignore files -> added to ig (with bug fixes 1 and 2)
     * 5. projectBundler.includeDocsFromGitignore -> skip docs/ patterns from .gitignore
     */
    public async loadAllRules(): Promise<void> {
        if (this.rulesLoaded) return;

        // 1. Load exclude folders from settings
        const config = vscode.workspace.getConfiguration('projectBundler');
        const excludeFolders = config.get<string[]>('excludeFolders', []);
        this.excludedFolderPatterns = [...excludeFolders];

        // 2. Load binary extensions from settings
        const binaryExtensions = config.get<string[]>('binaryExtensions', []);
        const binaryExtensionsArray = binaryExtensions.map(e => e.toLowerCase());
        this.binaryExtensions = new Set(binaryExtensionsArray);

        // 2.5. Load includeDocsFromGitignore option
        this.includeDocsFromGitignore = config.get<boolean>('includeDocsFromGitignore', false);

        // 2.6. Load useBundlerignore option
        this.useBundlerignore = config.get<boolean>('useBundlerignore', true);

        // 3. Add binary extensions to ignore as "**/*.<ext>" patterns
        const binaryPatterns = binaryExtensionsArray.map(ext => `**/*${ext}`);
        if (binaryPatterns.length > 0) {
            this.ig.add(binaryPatterns);
        }

        // 4. Load user excludes (userExcludes + customExcludes for backward compat)
        const userExcludes = config.get<string[]>('userExcludes', []);
        const customExcludes = config.get<string[]>('customExcludes', []);
        const allUserExcludes = [...userExcludes, ...customExcludes];
        if (allUserExcludes.length > 0) {
            this.ig.add(allUserExcludes);
        }

        // 5. Scan and merge all .gitignore files
        await this.scanAndMergeGitignoreFiles();

        // 6. Scan and merge all .bundlerignore files (if enabled)
        if (this.useBundlerignore) {
            await this.scanAndMergeBundlerignoreFiles();
        }

        this.rulesLoaded = true;
    }

    /**
     * Simple glob matching for folder patterns
     * Supports: exact match, prefix*, *suffix
     */
    private simpleGlobMatch(value: string, pattern: string): boolean {
        // No wildcard - exact match
        if (!pattern.includes('*')) {
            return value === pattern;
        }

        // Starts with * (suffix match)
        if (pattern.startsWith('*') && !pattern.endsWith('*')) {
            const suffix = pattern.substring(1);
            return value.endsWith(suffix);
        }

        // Ends with * (prefix match)
        if (pattern.endsWith('*') && !pattern.startsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return value.startsWith(prefix);
        }

        // * on both sides - contains
        if (pattern.startsWith('*') && pattern.endsWith('*') && pattern.length > 2) {
            const middle = pattern.slice(1, -1);
            return value.includes(middle);
        }

        // Single * - matches everything
        if (pattern === '*') {
            return true;
        }

        // For more complex patterns, fall back to simple regex conversion
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(value);
    }

    /**
     * Fast folder exclusion check - does NOT use ignore library
     * Checks folder name against excludedFolderPatterns using simple glob matching
     * 
     * @param folderName - The name of the folder (e.g., "node_modules")
     * @param fullFsPath - Full filesystem path to the folder (for future use if needed)
     * @returns true if folder should be excluded from scanning
     */
    public isFolderExcluded(folderName: string, fullFsPath: string): boolean {
        for (const pattern of this.excludedFolderPatterns) {
            if (this.simpleGlobMatch(folderName, pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a file should be excluded (treated as binary)
     * @param fsPath - Full filesystem path to the file
     * @returns true if file is binary/excluded
     */
    public isBinary(fsPath: string): boolean {
        const ext = path.extname(fsPath).toLowerCase();
        return this.binaryExtensions.has(ext);
    }

    /**
     * Check if a file is ignored by the ignore rules
     * @param fsPath - Full filesystem path to the file
     * @returns true if file should be ignored
     */
    public async isFileExcluded(fsPath: string): Promise<boolean> {
        if (!this.rulesLoaded) {
            // Auto-load rules if not loaded yet (backward compatibility)
            await this.loadAllRules();
        }

        const relativePath = path.relative(this.workspaceRoot, fsPath);
        if (!relativePath || relativePath.startsWith('..')) { return false; }

        // ignore lib requires forward slashes
        const normalizedPath = relativePath.split(path.sep).join('/');

        if (!normalizedPath) return false;

        return this.ig.ignores(normalizedPath);
    }

    /**
     * Alias for isFileExcluded for backward compatibility
     */
    public async isIgnored(fsPath: string): Promise<boolean> {
        return this.isFileExcluded(fsPath);
    }

    /**
     * Scan workspace for all .gitignore files and merge their rules
     * Includes fixes for:
     * - BUG #1: Pattern without slash (*.py, *) - scope to directory
     * - BUG #2: Pattern with leading slash (/dist) - remove / and scope to directory
     */
    private async scanAndMergeGitignoreFiles(): Promise<void> {
        try {
            // Find all .gitignore files, excluding node_modules for performance
            const pattern = new vscode.RelativePattern(this.workspaceRoot, '**/.gitignore');
            const gitignoreFiles = await vscode.workspace.findFiles(
                pattern,
                '**/node_modules/**'
            );

            const allRules: string[] = [];

            for (const uri of gitignoreFiles) {
                const gitignorePath = uri.fsPath;
                const gitignoreDir = path.dirname(gitignorePath);

                // Calculate path relative to workspace root
                const relativeDir = path.relative(this.workspaceRoot, gitignoreDir);

                try {
                    const content = fs.readFileSync(gitignorePath, 'utf-8');
                    const lines = content.split('\n');

                    for (let line of lines) {
                        line = line.trim();

                        // Skip empty lines and comments
                        if (!line || line.startsWith('#')) continue;

                        // If includeDocsFromGitignore is enabled, skip docs/ related patterns
                        if (this.includeDocsFromGitignore && this.isDocsPattern(line)) {
                            continue;
                        }

                        // Normalize relativeDir once per file
                        const normalizedRelativeDir = relativeDir && relativeDir !== ''
                            ? relativeDir.split(path.sep).join('/')
                            : '';

                        // BUG 2: Pattern with leading slash (/dist) - remove / and scope to directory
                        if (line.startsWith('/')) {
                            line = line.substring(1);
                            if (normalizedRelativeDir) {
                                line = `${normalizedRelativeDir}/${line}`;
                            }
                        }
                        // BUG 1: Pattern without slash (*.py, *) - scope to its directory
                        else if (!line.startsWith('/') && !line.includes('/')) {
                            if (normalizedRelativeDir) {
                                // *.py in ocr-service/.gitignore -> ocr-service/**/*.py
                                line = `${normalizedRelativeDir}/**/${line}`;
                            }
                            // At workspaceRoot level (normalizedRelativeDir === '') - leave as-is
                        }
                        // Pattern with / but no leading slash - prepend relative directory
                        else if (!line.startsWith('/') && line.includes('/')) {
                            if (normalizedRelativeDir) {
                                line = `${normalizedRelativeDir}/${line}`;
                            }
                        }

                        allRules.push(line);
                    }
                } catch (e) {
                    console.error(`Error reading .gitignore at ${gitignorePath}:`, e);
                }
            }

            // Add all merged rules to ignore instance
            if (allRules.length > 0) {
                this.ig.add(allRules);
            }

            console.log(`[IgnoreEngine] Merged ${allRules.length} rules from ${gitignoreFiles.length} .gitignore file(s)`);
        } catch (e) {
            console.error('Error scanning for nested .gitignore files:', e);
        }
    }

    /**
     * Check if a gitignore pattern relates to docs/ folder
     * Used to skip docs/ patterns when includeDocsFromGitignore is enabled
     */
    private isDocsPattern(pattern: string): boolean {
        // Direct docs/ patterns
        if (pattern === 'docs' || pattern === 'docs/' || pattern === '/docs' || pattern === '/docs/') {
            return true;
        }
        
        // Glob patterns matching docs (e.g., **/docs, docs/**, *docs*)
        if (pattern.includes('docs')) {
            const normalized = pattern.replace(/^\/+/, '').replace(/\/+$/, '');
            if (normalized === 'docs' || normalized.startsWith('docs/') || normalized.endsWith('/docs') || normalized.includes('docs/')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Scan workspace for all .bundlerignore files and merge their rules
     * .bundlerignore works like .gitignore but only for PromptPack
     */
    private async scanAndMergeBundlerignoreFiles(): Promise<void> {
        try {
            // Find all .bundlerignore files, excluding node_modules for performance
            const pattern = new vscode.RelativePattern(this.workspaceRoot, '**/.bundlerignore');
            const bundlerignoreFiles = await vscode.workspace.findFiles(
                pattern,
                '**/node_modules/**'
            );

            const allRules: string[] = [];

            for (const uri of bundlerignoreFiles) {
                const bundlerignorePath = uri.fsPath;
                const bundlerignoreDir = path.dirname(bundlerignorePath);

                // Calculate path relative to workspace root
                const relativeDir = path.relative(this.workspaceRoot, bundlerignoreDir);

                try {
                    const content = fs.readFileSync(bundlerignorePath, 'utf-8');
                    const lines = content.split('\n');

                    for (let line of lines) {
                        line = line.trim();

                        // Skip empty lines and comments
                        if (!line || line.startsWith('#')) continue;

                        // Normalize relativeDir once per file
                        const normalizedRelativeDir = relativeDir && relativeDir !== ''
                            ? relativeDir.split(path.sep).join('/')
                            : '';

                        // Pattern with leading slash (/dist) - remove / and scope to directory
                        if (line.startsWith('/')) {
                            line = line.substring(1);
                            if (normalizedRelativeDir) {
                                line = `${normalizedRelativeDir}/${line}`;
                            }
                        }
                        // Pattern without slash (*.py, *) - scope to its directory
                        else if (!line.startsWith('/') && !line.includes('/')) {
                            if (normalizedRelativeDir) {
                                line = `${normalizedRelativeDir}/**/${line}`;
                            }
                            // At workspaceRoot level (normalizedRelativeDir === '') - leave as-is
                        }
                        // Pattern with / but no leading slash - prepend relative directory
                        else if (!line.startsWith('/') && line.includes('/')) {
                            if (normalizedRelativeDir) {
                                line = `${normalizedRelativeDir}/${line}`;
                            }
                        }

                        allRules.push(line);
                    }
                } catch (e) {
                    console.error(`Error reading .bundlerignore at ${bundlerignorePath}:`, e);
                }
            }

            // Add all merged rules to ignore instance
            if (allRules.length > 0) {
                this.ig.add(allRules);
            }

            console.log(`[IgnoreEngine] Merged ${allRules.length} rules from ${bundlerignoreFiles.length} .bundlerignore file(s)`);
        } catch (e) {
            console.error('Error scanning for nested .bundlerignore files:', e);
        }
    }
}
