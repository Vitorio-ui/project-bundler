import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';

export class IgnoreEngine {
    private ig = ignore();
    private rulesLoaded = false;

    // System & Build artifacts for multiple languages
    private alwaysExclude = [
        // Version Control
        '.git/', '.svn/', '.hg/',

        // IDEs
        '.idea/', '.vscode/', '.vs/',

        // JavaScript / TypeScript
        'node_modules/', 'out/', 'dist/', 'coverage/',

        // Python
        '__pycache__/', 'venv/', '.venv/', 'env/', '.env/', '.pytest_cache/',
        '*.pyc', '*.pyd', '*.pyo',

        // Java / Kotlin
        '.gradle/', 'target/', 'build/', '*.class', '*.jar', '*.war',

        // C / C++ / C#
        'bin/', 'obj/', 'Debug/', 'Release/', 'cmake-build-debug/', 'cmake-build-release/',
        '*.exe', '*.dll', '*.so', '*.dylib', '*.o', '*.obj', '*.lib', '*.a', '*.pdb',

        // Rust
        'target/', '*.rlib',

        // Go
        'vendor/',

        // System
        '.DS_Store', 'Thumbs.db'
    ];

    constructor(private workspaceRoot: string) {
        // Rules loaded on-demand via loadAllRules()
    }

    /**
     * Load all ignore rules from:
     * 1. Hardcoded alwaysExclude
     * 2. Root .gitignore
     * 3. All nested .gitignore files
     * 4. User customExcludes settings
     */
    public async loadAllRules(): Promise<void> {
        if (this.rulesLoaded) return;

        // 1. Hardcoded excludes
        this.ig.add(this.alwaysExclude);

        // 2. Scan and merge all .gitignore files
        await this.scanAndMergeGitignoreFiles();

        // 3. User settings
        const config = vscode.workspace.getConfiguration('projectBundler');
        const customExcludes = config.get<string[]>('customExcludes', []);
        if (customExcludes.length > 0) {
            this.ig.add(customExcludes);
        }

        this.rulesLoaded = true;
    }

    /**
     * Scan workspace for all .gitignore files and merge their rules
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
                        
                        // Convert relative patterns to absolute from workspace root
                        // If pattern doesn't start with / and contains no /, it matches everywhere
                        // If pattern contains / (but doesn't start with it), it's relative to .gitignore location
                        if (!line.startsWith('/') && line.includes('/')) {
                            // Pattern is relative to .gitignore directory
                            // Prepend the relative directory path
                            if (relativeDir && relativeDir !== '') {
                                const normalizedRelativeDir = relativeDir.split(path.sep).join('/');
                                line = `${normalizedRelativeDir}/${line}`;
                            }
                        } else if (!line.startsWith('/') && !line.includes('/')) {
                            // Pattern without slash matches everywhere (e.g., *.log, __pycache__)
                            // Keep as-is, it will match at all levels
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

    public isIgnored(fsPath: string): boolean {
        if (!this.rulesLoaded) {
            // Auto-load rules if not loaded yet (backward compatibility)
            this.loadAllRules();
        }

        const relativePath = path.relative(this.workspaceRoot, fsPath);
        if (!relativePath || relativePath.startsWith('..')) { return false; }

        // ignore lib requires forward slashes
        const normalizedPath = relativePath.split(path.sep).join('/');

        if (!normalizedPath) return false;

        return this.ig.ignores(normalizedPath);
    }
}