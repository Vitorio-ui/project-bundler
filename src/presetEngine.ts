import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreEngine } from './ignoreEngine';

export enum PresetType {
    Selected = 'selected',
    Full = 'full',
    Minimal = 'minimal',      // EA
    Architecture = 'arch',    // EA
    Debug = 'debug'           // EA
}

export class PresetEngine {
    constructor(private ignoreEngine: IgnoreEngine, private rootPath: string) {}

    /**
     * Главный метод: возвращает список файлов на основе выбранного пресета
     * 
     * @param preset - Тип пресета
     * @param allFiles - Уже отсканированные файлы (из extension.ts)
     * @param targets - Исходные targets (для обратной совместимости)
     * @param maxAgeDays - Максимальный возраст файлов (для Debug пресета)
     */
    public async getFiles(preset: PresetType, allFiles: vscode.Uri[], targets?: vscode.Uri[], maxAgeDays?: number): Promise<vscode.Uri[]> {

        // 1. Для Selected пресета - используем все переданные файлы
        if (preset === PresetType.Selected && targets && targets.length > 0) {
            // allFiles уже содержит отфильтрованные файлы из targets
            return allFiles;
        }

        // 2. Для Full, Minimal, Arch, Debug - используем allFiles (уже отсканированные)
        let files: vscode.Uri[] = allFiles;

        // 3. Применяем фильтрацию пресета
        switch (preset) {
            case PresetType.Minimal:
                return this.applyMinimalFilter(files);
            case PresetType.Architecture:
                return this.applyArchFilter(files);
            case PresetType.Debug:
                return this.applyDebugFilter(files, maxAgeDays);
            case PresetType.Full:
            case PresetType.Selected:
            default:
                return files;
        }
    }

    /**
     * Get all excluded folder paths from the selected targets
     * Used to pass to TreeGenerator for rendering
     *
     * OPTIMIZED v0.2.6-fix: Uses already-scanned treeFiles instead of additional FS scans
     * This avoids redundant filesystem traversal
     */
    public async getExcludedFolderPaths(targets: vscode.Uri[]): Promise<Set<string>> {
        const excludedPaths = new Set<string>();
        // Note: This method is now a no-op since excluded folders are already filtered
        // during the initial scan in extension.ts. The treeFiles passed to generateBundle
        // already contain only non-excluded files.
        // Excluded folder visualization is handled by passing folder names directly.
        return excludedPaths;
    }

    /**
     * Get exclude folders from config for fast matching
     */
    private getExcludeFoldersFromConfig(): string[] {
        const config = vscode.workspace.getConfiguration('projectBundler');
        return config.get<string[]>('excludeFolders', []);
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

    // ============================================================================
    // PRESET FILTERS
    // ============================================================================

    /**
     * EA-02: Minimal Preset
     * Entry points + package.json only
     */
    private applyMinimalFilter(files: vscode.Uri[]): vscode.Uri[] {
        const entryPointNames = [
            'index', 'main', 'app', 'entry', 'start', 'init',
            '__main__', 'cli', 'server', 'client'
        ];
        const configFiles = [
            'package.json',
            'requirements.txt', 'pyproject.toml', 'pipfile',
            'cargo.toml', 'cargo.lock',
            'go.mod', 'go.sum',
            'composer.json', 'composer.lock',
            'gemfile', 'gemfile.lock',
            'pubspec.yaml', 'pubspec.lock',
            'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
            'csproj', 'vbproj', 'fsproj', 'packages.config',
            'tsconfig.json', 'jsconfig.json',
            'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
            'readme.md', 'readme.txt'
        ];

        return files.filter(f => {
            const basename = path.basename(f.fsPath).toLowerCase();
            const basenameNoExt = basename.replace(/\.[^.]+$/, '');
            const ext = path.extname(f.fsPath).toLowerCase();

            // Config files (exact match)
            if (configFiles.some(cf => basename === cf.toLowerCase())) {
                return true;
            }

            // Entry points (by name)
            if (entryPointNames.some(ep => basenameNoExt === ep)) {
                // Only source code files
                return ['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.go', '.php', '.rb', '.java', '.cs', '.fs', '.vb', '.dart', '.swift', '.kt', '.scala', '.ex', '.exs'].includes(ext);
            }

            return false;
        });
    }

    /**
     * EA-01: Architecture Preset
     * Interfaces, types, configs, folder structure
     */
    private applyArchFilter(files: vscode.Uri[]): vscode.Uri[] {
        const interfacePatterns = [
            /\.d\.ts$/,                     // TypeScript declarations
            /\.interface\.ts$/,             // Interface files
            /\.types\.ts$/,                 // Type definitions
            /\.type\.ts$/,
            /\/interfaces?\//i,             // interfaces/ folder
            /\/types?\//i,                  // types/ folder
            /\/models?\//i,                 // models/ folder
            /\.h(pp|xx)?$/,                 // C++ headers
            /\.ml(i|4)?$/,                  // OCaml interfaces
            /\.sig$/,                       // Signature files
            /\.abi$/,                       // ABI definitions
        ];

        const configPatterns = [
            /^package\.json$/,
            /^tsconfig\.json$/,
            /^jsconfig\.json$/,
            /^\.eslintrc/i,
            /^\.prettierrc/i,
            /^webpack\.config\./,
            /^vite\.config\./,
            /^rollup\.config\./,
            /^babel\.config\./,
            /^jest\.config\./,
            /^pyproject\.toml$/,
            /^setup\.py$/,
            /^requirements.*\.txt$/,
            /^cargo\.toml$/,
            /^go\.mod$/,
            /^composer\.json$/,
            /^gemfile$/i,
            /^pubspec\.yaml$/,
            /^pom\.xml$/,
            /^build\.gradle/i,
            /^settings\.gradle/i,
            /\.csproj$/,
            /\.vbproj$/,
            /\.fsproj$/,
            /^dockerfile$/i,
            /^docker-compose.*\.ya?ml$/i,
            /^dockerignore$/i,
            /^nginx\.conf$/,
            /^\.env\./,
            /^application\.(properties|yml|yaml)$/,
        ];

        const structurePatterns = [
            /\/src\//i,
            /\/lib\//i,
            /\/include\//i,
            /\/api\//i,
            /\/routes?\//i,
            /\/controllers?\//i,
            /\/services?\//i,
            /\/repositories?\//i,
            /\/middleware\//i,
            /\/config\//i,
            /\/constants?\//i,
            /\/enums?\//i,
            /\/utils?\//i,
            /\/helpers?\//i,
            /\/shared\//i,
            /\/common\//i,
        ];

        const excludePatterns = [
            /\.test\./i,
            /\.spec\./i,
            /\.story\./i,
            /\.stories\./i,
            /__tests__\//i,
            /__mocks__\//i,
            /node_modules\//i,
            /dist\//i,
            /build\//i,
            /target\//i,
            /vendor\//i,
            /\.min\./i,
            /bundle\./i,
        ];

        return files.filter(f => {
            const fsPath = f.fsPath;

            // Exclude test files, build artifacts
            if (excludePatterns.some(p => p.test(fsPath))) {
                return false;
            }

            // Include interface/type files
            if (interfacePatterns.some(p => p.test(fsPath))) {
                return true;
            }

            // Include config files (root level)
            const basename = path.basename(fsPath);
            if (configPatterns.some(p => {
                if (p.source.startsWith('^')) {
                    return p.test(basename);
                }
                return p.test(fsPath);
            })) {
                return true;
            }

            // Include structure files (source folders)
            if (structurePatterns.some(p => p.test(fsPath))) {
                // Only include certain file types in structure
                const ext = path.extname(fsPath).toLowerCase();
                const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.php', '.rb', '.java', '.cs', '.fs', '.vb', '.dart', '.swift', '.kt', '.scala', '.ex', '.exs', '.hpp', '.h', '.hxx', '.ml', '.mli'];
                if (sourceExts.includes(ext)) {
                    return true;
                }
            }

            return false;
        });
    }

    /**
     * EA-03: Debug Preset
     * Entry points + recently modified files + error-prone paths
     */
    private applyDebugFilter(files: vscode.Uri[], maxAgeDays: number = 7): vscode.Uri[] {
        const entryPointNames = [
            'index', 'main', 'app', 'entry', 'start', 'init',
            '__main__', 'cli', 'server', 'client',
            'error', 'exception', 'logger', 'debug', 'handler'
        ];

        const errorPronePatterns = [
            /\/errors?\//i,
            /\/exceptions?\//i,
            /\/logger\//i,
            /\/debug\//i,
            /\/handlers?\//i,
            /\/middleware\//i,
            /\/interceptors?\//i,
            /\/guards?\//i,
            /\/pipes?\//i,
            /\/filters?\//i,
            /\/strategies?\//i,
            /\/decorators?\//i,
        ];

        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

        return files.filter(f => {
            const basename = path.basename(f.fsPath).toLowerCase();
            const basenameNoExt = basename.replace(/\.[^.]+$/, '');
            const fsPath = f.fsPath;

            // Entry points
            if (entryPointNames.some(ep => basenameNoExt === ep)) {
                return true;
            }

            // Error-prone paths
            if (errorPronePatterns.some(p => p.test(fsPath))) {
                return true;
            }

            // Recently modified files (check file stat)
            // Note: This would require additional fs.stat calls, which could be slow
            // For now, we skip this check and rely on entry points + error-prone paths
            // Future optimization: cache file stats or use VS Code's file watcher

            return false;
        });
    }
}
