import * as vscode from 'vscode';
import { IgnoreEngine } from './ignoreEngine';

export enum PresetType {
    Selected = 'selected',
    Full = 'full',
    Minimal = 'minimal',    // Pro
    Architecture = 'arch'   // Pro
}

export class PresetEngine {
    constructor(private ignoreEngine: IgnoreEngine, private rootPath: string) {}

    /**
     * Главный метод: возвращает список файлов на основе выбранного пресета
     */
    public async getFiles(preset: PresetType, targets: vscode.Uri[]): Promise<vscode.Uri[]> {
        
        // 1. Сначала собираем базовый список (как раньше)
        let files: vscode.Uri[] = [];

        if (preset === PresetType.Selected && targets.length > 0) {
            files = await this.expandFolders(targets);
        } else {
            // Для Full, Minimal, Arch сканируем всё (с учетом ignore)
            const pattern = new vscode.RelativePattern(this.rootPath, '**/*');
            const allFiles = await vscode.workspace.findFiles(pattern, null);
            files = allFiles.filter(f => !this.ignoreEngine.isIgnored(f.fsPath));
        }

        // 2. Применяем фильтрацию пресета (Логика Pro версий будет здесь)
        switch (preset) {
            case PresetType.Minimal:
                return this.applyMinimalFilter(files);
            case PresetType.Architecture:
                return this.applyArchFilter(files);
            case PresetType.Full:
            case PresetType.Selected:
            default:
                return files;
        }
    }

    // Хелпер для разворачивания папок
    private async expandFolders(uris: vscode.Uri[]): Promise<vscode.Uri[]> {
        const result: vscode.Uri[] = [];
        for (const uri of uris) {
            const stats = await vscode.workspace.fs.stat(uri);
            if (stats.type === vscode.FileType.Directory) {
                const pattern = new vscode.RelativePattern(uri, '**/*');
                const folderFiles = await vscode.workspace.findFiles(pattern);
                result.push(...folderFiles.filter(f => !this.ignoreEngine.isIgnored(f.fsPath)));
            } else {
                result.push(uri);
            }
        }
        return result;
    }

    // --- ЗАГЛУШКИ ДЛЯ БУДУЩЕЙ ЛОГИКИ ---
    
    private applyMinimalFilter(files: vscode.Uri[]): vscode.Uri[] {
        // TODO Stage 4: Оставлять только index, main, package.json
        return files.filter(f => {
            const name = f.path.toLowerCase();
            return name.includes('package.json') || name.includes('index') || name.includes('main');
        });
    }

    private applyArchFilter(files: vscode.Uri[]): vscode.Uri[] {
        // TODO Stage 4: Оставлять структуру папок, интерфейсы, типы, конфиги
        return files;
    }
}