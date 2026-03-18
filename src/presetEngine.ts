import * as vscode from 'vscode';
import * as path from 'path';
import { IgnoreEngine } from './ignoreEngine';
import { FileAnalyzer, FileMeta } from './presetAnalyzer';
import { FileScorer } from './presetScorer';
import { PresetSelector, PresetType } from './presetSelector';

/**
 * PresetEngine - Orchestrator Layer
 * 
 * Coordinates the 3-layer preset architecture:
 * 1. FileAnalyzer - collects semantic metadata
 * 2. FileScorer - calculates importance scores
 * 3. PresetSelector - applies preset-specific filtering
 * 
 * This is the "conductor" that makes presets work as "ways of thinking"
 */
export class PresetEngine {

    private analyzer: FileAnalyzer;
    private scorer: FileScorer;
    private selector: PresetSelector;

    constructor(
        private ignoreEngine: IgnoreEngine,
        private rootPath: string
    ) {
        this.analyzer = new FileAnalyzer(rootPath, ignoreEngine);
        this.scorer = new FileScorer();
        this.selector = new PresetSelector(this.scorer);
    }

    /**
     * Главный метод: возвращает список файлов на основе выбранного пресета
     * 
     * @param preset - Тип пресета
     * @param allFiles - Уже отсканированные файлы (из extension.ts)
     * @param targets - Исходные targets (для обратной совместимости, не используется)
     * @param maxAgeDays - Максимальный возраст файлов (для Debug пресета)
     */
    public async getFiles(
        preset: PresetType,
        allFiles: vscode.Uri[],
        targets?: vscode.Uri[],
        maxAgeDays?: number
    ): Promise<vscode.Uri[]> {
        const effectiveMaxAgeDays = maxAgeDays ?? 7;

        // 1. Для Selected пресета - используем все переданные файлы
        if (preset === PresetType.Selected && targets && targets.length > 0) {
            return allFiles;
        }

        // 2. Для Full пресета - возвращаем все файлы
        if (preset === PresetType.Full) {
            return allFiles;
        }

        // 3. Для Minimal, Architecture, Debug - применяем интеллектуальную фильтрацию
        
        // HARD PROTECTION: Remove duplicate files (fix for bug 0.1.3)
        const uniqueFiles = Array.from(
            new Map(allFiles.map(f => [f.fsPath, f])).values()
        );

        // Шаг 1: Анализируем файлы (собираем метаданные)
        const meta = await this.analyzer.analyze(uniqueFiles);

        // Шаг 2: Считаем важность файлов
        this.scorer.score(meta, effectiveMaxAgeDays);

        // Шаг 3: Применяем логику пресета
        return this.selector.select(preset, meta, effectiveMaxAgeDays);
    }

    /**
     * Get all excluded folder paths from the selected targets
     * Used to pass to TreeGenerator for rendering
     */
    public async getExcludedFolderPaths(targets: vscode.Uri[]): Promise<Set<string>> {
        // Note: This is now a no-op since excluded folders are already filtered
        // during the initial scan in extension.ts
        return new Set<string>();
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
                // Use proper relative path calculation
                const relativePath = path.relative(this.rootPath, file.fsPath).split(path.sep).join('/');
                binaryPaths.add(relativePath);
            }
        }

        return binaryPaths;
    }
}

export { PresetType } from './presetSelector';
export { FileMeta } from './presetAnalyzer';
