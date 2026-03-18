import { FileMeta } from './presetAnalyzer';

/**
 * FileScorer - Layer 2
 * Calculates file importance scores
 *
 * This is the "magic" that makes presets smart
 * 
 * SCORING PHILOSOPHY:
 * - Sharp weights: entry/config dominate, noise is heavily penalized
 * - Clear separation: important files score 500+, noise scores <100
 */
export class FileScorer {

    /**
     * Score all files based on semantic importance
     * Higher score = more important for understanding the project
     */
    public score(files: FileMeta[], maxAgeDays: number = 7): FileMeta[] {
        const now = Date.now();

        for (const f of files) {
            f.score = 0;

            // ========================================================================
            // SEMANTIC IMPORTANCE (sharp weights)
            // ========================================================================

            // Entry points are most important (dominant signal)
            if (f.isEntry) f.score += 1000;

            // Config files are critical for project setup
            if (f.isConfig) f.score += 500;

            // Interfaces define contracts
            if (f.isInterface) f.score += 200;

            // ========================================================================
            // STRUCTURAL IMPORTANCE
            // ========================================================================

            // Files closer to root are typically more important
            if (f.depth <= 2) f.score += 100;
            else if (f.depth <= 4) f.score += 50;
            // Depth penalty for deep files
            else f.score -= 50 * (f.depth - 4);

            // Core folders indicate important business logic
            if (f.relativePath.includes('/core/')) f.score += 150;
            if (f.relativePath.includes('/src/')) f.score += 80;
            if (f.relativePath.includes('/services/')) f.score += 100;
            if (f.relativePath.includes('/api/')) f.score += 90;
            if (f.relativePath.includes('/lib/')) f.score += 70;

            // ========================================================================
            // DYNAMIC IMPORTANCE (recency)
            // ========================================================================

            if (f.lastModified) {
                const age = now - f.lastModified;
                const days = age / (1000 * 60 * 60 * 24);

                // Very recent files (today)
                if (days < 1) f.score += 300;
                // Recent files (this week)
                else if (days < maxAgeDays) f.score += 100;
            }

            // ========================================================================
            // PENALTIES (heavy)
            // ========================================================================

            // Test files are important but not for minimal view
            if (f.isTest) f.score -= 500;

            // Binary files are never included in content
            if (f.isBinary) f.score -= 1000;

            // Large files penalty (>20KB) - they consume too many tokens
            const sizeKB = (f.sizeBytes || 0) / 1024;
            if (sizeKB > 20) {
                f.score -= 100 * Math.floor((sizeKB - 20) / 10); // -100 per 10KB over 20KB
            }

            // Build artifacts and vendor code
            if (f.relativePath.includes('/dist/') ||
                f.relativePath.includes('/build/') ||
                f.relativePath.includes('/node_modules/') ||
                f.relativePath.includes('/vendor/') ||
                f.relativePath.includes('/target/') ||
                f.relativePath.includes('/out/')) {
                f.score -= 1000;
            }
        }

        return files;
    }

    /**
     * Get files sorted by score (descending)
     */
    public sortByScore(files: FileMeta[]): FileMeta[] {
        return files.sort((a, b) => b.score - a.score);
    }

    /**
     * Get top N scoring files
     */
    public topN(files: FileMeta[], n: number): FileMeta[] {
        return this.sortByScore(files).slice(0, n);
    }
}
