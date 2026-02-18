import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';

export class IgnoreEngine {
    private ig = ignore();
    
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
        this.loadRules();
    }

    private loadRules() {
        // 1. Hardcoded excludes
        this.ig.add(this.alwaysExclude);

        // 2. .gitignore
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            try {
                this.ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
            } catch (e) {
                console.error('Error reading .gitignore:', e);
            }
        }

        // 3. User settings
        const config = vscode.workspace.getConfiguration('projectBundler');
        const customExcludes = config.get<string[]>('customExcludes', []);
        if (customExcludes.length > 0) {
            this.ig.add(customExcludes);
        }
    }

    public isIgnored(fsPath: string): boolean {
        const relativePath = path.relative(this.workspaceRoot, fsPath);
        if (!relativePath || relativePath.startsWith('..')) { return false; }
        
        // ignore lib requires forward slashes
        const normalizedPath = relativePath.split(path.sep).join('/');
        
        if (!normalizedPath) return false;

        return this.ig.ignores(normalizedPath);
    }
}