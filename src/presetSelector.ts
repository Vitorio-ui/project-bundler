import * as vscode from 'vscode';
import { FileMeta } from './presetAnalyzer';
import { FileScorer } from './presetScorer';

/**
 * PresetSelector - Layer 3
 * Applies preset-specific filtering logic
 * 
 * Different "ways of thinking" about the project
 */
export class PresetSelector {

    constructor(
        private scorer: FileScorer
    ) {}

    /**
     * Select files based on preset type
     */
    public select(preset: PresetType, files: FileMeta[], maxAgeDays: number = 7): vscode.Uri[] {
        // Debug logging for troubleshooting
        console.log('[PresetSelector]', {
            preset,
            totalFiles: files.length,
            top10: files
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map(f => ({
                    file: f.relativePath,
                    score: f.score,
                    flags: {
                        entry: f.isEntry,
                        config: f.isConfig,
                        interface: f.isInterface,
                        test: f.isTest
                    }
                }))
        });

        switch (preset) {
            case PresetType.Minimal:
                return this.minimal(files);
            case PresetType.Architecture:
                return this.architecture(files);
            case PresetType.Debug:
                return this.debug(files, maxAgeDays);
            default:
                return files.map(f => f.uri);
        }
    }

    // ============================================================================
    // PRESET STRATEGIES
    // ============================================================================

    /**
     * 🟢 Minimal Preset - "How to run the project?"
     *
     * Intent: Get the minimal set of files needed to understand and run the project
     * Strategy: Hard constraints - only entry points, configs, and root docs
     * Expected: 5-15 files
     */
    private minimal(files: FileMeta[]): vscode.Uri[] {
        const result = files.filter(f =>
            // Always include entry points
            f.isEntry ||
            // Always include config files
            f.isConfig ||
            // Include root documentation
            f.isRootDoc
        );

        // Sort by score and limit to 10 files maximum
        return this.scorer
            .sortByScore(result)
            .slice(0, 10)
            .map(f => f.uri);
    }

    /**
     * 🔵 Architecture Preset - "How is the project structured?"
     *
     * Intent: Understand the project skeleton and architecture
     * Strategy: Hard depth constraint + exclude noise + exclude very large files
     * Expected: 15-40 files
     */
    private architecture(files: FileMeta[]): vscode.Uri[] {
        const MAX_FILE_SIZE_KB = 15; // Exclude files >15KB to avoid token bloat

        const result = files.filter(f => {
            // Exclude test files - they're noise for architecture understanding
            if (f.isTest) return false;

            // Exclude binary files
            if (f.isBinary) return false;

            // Exclude very large files (they dominate token count)
            if (f.sizeBytes > MAX_FILE_SIZE_KB * 1024) return false;

            // Always include config files - they define project structure
            if (f.isConfig) return true;

            // Always include interfaces - they define contracts
            if (f.isInterface) return true;

            // Include source code files near the root (depth <= 3)
            // These are typically the skeleton of the project
            if (f.depth <= 3 && this.isSourceCode(f.ext)) {
                return true;
            }

            // Include files in core architectural folders (with depth limit)
            if (f.depth <= 5 && (
                f.relativePath.includes('/core/') ||
                f.relativePath.includes('/services/') ||
                f.relativePath.includes('/api/') ||
                f.relativePath.includes('/lib/')
            )) {
                return this.isSourceCode(f.ext);
            }

            return false;
        });

        // Sort by score and limit to 40 files maximum
        return this.scorer
            .sortByScore(result)
            .slice(0, 40)
            .map(f => f.uri);
    }

    /**
     * 🔴 Debug Preset - "Where might the problem be?"
     *
     * Intent: Focus on files most likely to contain or relate to bugs
     * Strategy: Prioritized filtering - recent > error-prone > entry
     * Expected: 15-25 files
     */
    private debug(files: FileMeta[], maxAgeDays: number): vscode.Uri[] {
        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

        // Priority 1: Recently modified files (bugs often appear after changes)
        const recentFiles = files.filter(f =>
            f.lastModified && (now - f.lastModified) < maxAgeMs
        );

        // Priority 2: Error-prone locations
        const errorProneFiles = files.filter(f =>
            this.isErrorProne(f.relativePath) && !recentFiles.includes(f)
        );

        // Priority 3: Entry points (not already included)
        const entryFiles = files.filter(f =>
            f.isEntry && !recentFiles.includes(f) && !errorProneFiles.includes(f)
        );

        // Combine in priority order
        const combined = [...recentFiles, ...errorProneFiles, ...entryFiles];

        // Sort by score and limit to 25 files maximum
        return this.scorer
            .sortByScore(combined)
            .slice(0, 25)
            .map(f => f.uri);
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private isSourceCode(ext: string): boolean {
        const sourceExts = [
            '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.php',
            '.rb', '.java', '.cs', '.fs', '.vb', '.dart', '.swift',
            '.kt', '.scala', '.ex', '.exs', '.hpp', '.h', '.hxx', '.ml', '.mli'
        ];
        return sourceExts.includes(ext);
    }

    private isErrorProne(rel: string): boolean {
        const errorPronePatterns = [
            /\/errors?\//i, /\/exceptions?\//i, /\/logger\//i, /\/debug\//i,
            /\/handlers?\//i, /\/middleware\//i, /\/interceptors?\//i,
            /\/guards?\//i, /\/pipes?\//i, /\/filters?\//i, /\/strategies?\//i,
            /\/decorators?\//i, /\/validators?\//i
        ];
        return errorPronePatterns.some(p => p.test(rel));
    }
}

export enum PresetType {
    Selected = 'selected',
    Full = 'full',
    Minimal = 'minimal',
    Architecture = 'arch',
    Debug = 'debug'
}
