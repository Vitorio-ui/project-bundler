import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';

export class IgnoreEngine {
    private ig = ignore();
    private alwaysExclude = [
        '.git/', 'node_modules/', '.idea/', '__pycache__/', 
        '*.pyc', '*.pt', '*.safetensors', '.DS_Store', 'out/', 'dist/'
    ];

    constructor(private workspaceRoot: string) {
        this.loadRules();
    }

    private loadRules() {
        this.ig.add(this.alwaysExclude);
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            this.ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
        }
    }

    public isIgnored(fsPath: string): boolean {
        const relativePath = path.relative(this.workspaceRoot, fsPath);
        if (!relativePath) { return false; }
        const normalizedPath = relativePath.split(path.sep).join('/');
        return this.ig.ignores(normalizedPath);
    }
}