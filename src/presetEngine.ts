import * as vscode from 'vscode';
import * as path from 'path';
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
            const excludePattern = this.buildExcludePattern();
            const allFiles = await vscode.workspace.findFiles(pattern, excludePattern || undefined);

            // Filter with await
            files = [];
            for (const f of allFiles) {
                if (!await this.ignoreEngine.isFileExcluded(f.fsPath)) {
                    files.push(f);
                }
            }
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

    /**
     * Get all excluded folder paths from the selected targets
     * Used to pass to TreeGenerator for rendering
     */
    public async getExcludedFolderPaths(targets: vscode.Uri[]): Promise<Set<string>> {
        const excludedPaths = new Set<string>();

        if (targets.length > 0) {
            // Scan from selected targets
            for (const uri of targets) {
                const stats = await vscode.workspace.fs.stat(uri);
                if (stats.type === vscode.FileType.Directory) {
                    await this.collectExcludedFolders(uri, excludedPaths);
                }
            }
        } else {
            // No targets (Full preset) - scan from rootPath
            const rootUri = vscode.Uri.file(this.rootPath);
            await this.collectExcludedFolders(rootUri, excludedPaths);
        }

        return excludedPaths;
    }

    /**
     * Recursively collect excluded folder paths
     */
    private async collectExcludedFolders(dirUri: vscode.Uri, excludedPaths: Set<string>): Promise<void> {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        
        for (const [name, type] of entries) {
            if (type === vscode.FileType.Directory) {
                const entryUri = vscode.Uri.joinPath(dirUri, name);
                const entryFsPath = entryUri.fsPath;
                
                // Check if this folder is excluded
                if (this.ignoreEngine.isFolderExcluded(name, entryFsPath)) {
                    const relativePath = path.relative(this.rootPath, entryFsPath).split(path.sep).join('/');
                    excludedPaths.add(relativePath);
                } else {
                    // Not excluded, recurse into subfolders
                    await this.collectExcludedFolders(entryUri, excludedPaths);
                }
            }
        }
    }

    /**
     * Get all binary file paths from the selected targets
     * Used to pass to TreeGenerator for rendering
     */
    public async getBinaryFilePaths(files: vscode.Uri[]): Promise<Set<string>> {
        const binaryPaths = new Set<string>();
        
        for (const file of files) {
            if (this.ignoreEngine.isBinary(file.fsPath)) {
                const relativePath = path.relative(this.rootPath, file.fsPath).split(path.sep).join('/');
                binaryPaths.add(relativePath);
            }
        }
        
        return binaryPaths;
    }

    /**
     * Build exclude pattern for findFiles() from excludeFolders setting
     * This prevents VS Code from even entering excluded folders during scanning
     */
    private buildExcludePattern(): string | null {
        const config = vscode.workspace.getConfiguration('projectBundler');
        const excludeFolders = config.get<string[]>('excludeFolders', []);
        const userExcludes = config.get<string[]>('userExcludes', []);
        const customExcludes = config.get<string[]>('customExcludes', []);
        const allUserExcludes = [...userExcludes, ...customExcludes];

        const allPatterns = [...excludeFolders, ...allUserExcludes];

        if (allPatterns.length === 0) {
            return null;
        }

        // Build glob pattern for findFiles exclude parameter
        // Each folder pattern becomes **/pattern/** to exclude at any depth
        const excludePatterns = allPatterns.map(pattern => {
            // Convert simple patterns to full globs
            if (!pattern.includes('*')) {
                // Exact folder name: node_modules -> **/node_modules/**
                return `**/${pattern}/**`;
            } else if (pattern.startsWith('*') && !pattern.endsWith('*')) {
                // Suffix: *_venv -> **/*_venv/**
                return `**/${pattern}/**`;
            } else if (pattern.endsWith('*') && !pattern.startsWith('*')) {
                // Prefix: .cache* -> **/.cache*/**
                return `**/${pattern}/**`;
            } else {
                // Complex pattern
                return `**/${pattern}/**`;
            }
        });

        // Return as brace expansion: {**/node_modules/**,**/venv/**}
        return `{${excludePatterns.join(',')}}`;
    }

    // Хелпер для разворачивания папок
    private async expandFolders(uris: vscode.Uri[]): Promise<vscode.Uri[]> {
        const result: vscode.Uri[] = [];
        const excludePattern = this.buildExcludePattern();

        for (const uri of uris) {
            const stats = await vscode.workspace.fs.stat(uri);
            if (stats.type === vscode.FileType.Directory) {
                const folderName = path.basename(uri.fsPath);
                
                // Check if this top-level folder is excluded
                if (this.ignoreEngine.isFolderExcluded(folderName, uri.fsPath)) {
                    continue; // не сканируем, не добавляем файлы
                }

                const pattern = new vscode.RelativePattern(uri, '**/*');
                // Pass exclude pattern to findFiles - VS Code won't enter excluded folders
                const folderFiles = await vscode.workspace.findFiles(pattern, excludePattern || undefined);
                
                // Filter with await
                for (const f of folderFiles) {
                    if (!await this.ignoreEngine.isFileExcluded(f.fsPath)) {
                        result.push(f);
                    }
                }
            } else {
                if (!await this.ignoreEngine.isFileExcluded(uri.fsPath)) {
                    result.push(uri);
                }
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
