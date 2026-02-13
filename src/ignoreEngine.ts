import * as vscode from 'vscode'; // Добавляем импорт vscode
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';

export class IgnoreEngine {
    private ig = ignore();
    
    // Хардкорные исключения (системные)
    private alwaysExclude = [
        '.git/', '.idea/', '.vscode/', '.vs/', 
        'node_modules/', '__pycache__/', 'venv/', 'env/',
        '*.pyc', '*.pt', '*.safetensors', '.DS_Store', 'out/', 'dist/',
        '*.vsix'
    ];

    constructor(private workspaceRoot: string) {
        this.loadRules();
    }

    private loadRules() {
        // 1. Жесткие исключения
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

        // 3. Пользовательские настройки (VS Code Settings)
        const config = vscode.workspace.getConfiguration('projectBundler');
        const customExcludes = config.get<string[]>('customExcludes', []);
        if (customExcludes.length > 0) {
            this.ig.add(customExcludes);
        }
    }

    public isIgnored(fsPath: string): boolean {
        const relativePath = path.relative(this.workspaceRoot, fsPath);
        if (!relativePath || relativePath.startsWith('..')) { return false; }
        
        // ignore lib требует пути с / (даже на Windows)
        const normalizedPath = relativePath.split(path.sep).join('/');
        
        // Проверяем, не является ли путь корнем (пустая строка)
        if (!normalizedPath) return false;

        return this.ig.ignores(normalizedPath);
    }
}