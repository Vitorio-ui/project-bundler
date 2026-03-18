/**
 * Token estimation using a more accurate model.
 * 
 * Different file types have different token densities:
 * - Code files: ~4 chars/token (average)
 * - Text/Markdown: ~4.5 chars/token
 * - JSON/YAML: ~5 chars/token (more verbose)
 * 
 * For better accuracy, we use a weighted average based on file extension.
 */

interface TokenDensity {
    extensions: string[];
    charsPerToken: number;
}

// Token density profiles for different file types
const TOKEN_DENSITIES: TokenDensity[] = [
    // Dense code (more symbols, shorter tokens)
    { extensions: ['.js', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.go', '.rs', '.swift', '.kt'], charsPerToken: 3.5 },
    // Scripting languages
    { extensions: ['.py', '.rb', '.php', '.sh', '.bash', '.zsh', '.ps1'], charsPerToken: 3.8 },
    // Web markup
    { extensions: ['.html', '.htm', '.xml', '.vue', '.svelte'], charsPerToken: 4.0 },
    // Styles
    { extensions: ['.css', '.scss', '.sass', '.less', '.styl'], charsPerToken: 4.2 },
    // Data formats
    { extensions: ['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'], charsPerToken: 5.0 },
    // Documentation
    { extensions: ['.md', '.markdown', '.txt', '.rst'], charsPerToken: 4.5 },
    // SQL and queries
    { extensions: ['.sql', '.graphql'], charsPerToken: 4.0 },
    // Config and misc
    { extensions: ['.env', '.gitignore', '.dockerignore', '.editorconfig'], charsPerToken: 4.5 },
];

const DEFAULT_CHARS_PER_TOKEN = 4.0;

export class TokenStats {
    /**
     * Get chars per token for a specific file extension
     */
    private static getCharsPerToken(extension: string): number {
        const ext = extension.toLowerCase();
        const density = TOKEN_DENSITIES.find(d => d.extensions.includes(ext));
        return density?.charsPerToken ?? DEFAULT_CHARS_PER_TOKEN;
    }

    /**
     * Estimate tokens for a single file content
     */
    public static estimateForFile(content: string, extension: string): number {
        const charsPerToken = this.getCharsPerToken(extension);
        return Math.ceil(content.length / charsPerToken);
    }

    /**
     * Estimate tokens for arbitrary content (legacy method)
     */
    public static estimate(content: string): number {
        return Math.ceil(content.length / DEFAULT_CHARS_PER_TOKEN);
    }

    /**
     * Estimate tokens for header section (constant approximation)
     * Header includes: bundle title, date, mode, root path, stats section
     */
    public static estimateHeader(): number {
        // Typical header:
        // "PROJECT BUNDLE | <project-name>\n"
        // "Generated: <datetime>\n"
        // "Mode: <mode>\n"
        // "Root: <path>\n"
        // "\n"
        // "Stats\n"
        // "  - Files: X (Y text, Z skipped)\n"
        // "  - KB: ~X.X KB\n"
        // "  - Tokens: ~Xk\n"
        // Average: ~200-300 chars = ~50-75 tokens
        return 65;
    }

    /**
     * Estimate tokens for tree structure
     */
    public static estimateTree(tree: string): number {
        // Tree structure uses box-drawing characters and paths
        // Typically ~4-5 chars per token due to structure
        return Math.ceil(tree.length / 4.5);
    }

    /**
     * Estimate tokens for content section markers
     * Each file has: "--- FILE: <path> ---\n" + optional date + content + "--- END OF FILE: <path> ---\n\n"
     */
    public static estimateContentMarkers(filesCount: number, avgPathLength: number = 50): number {
        // Per file: "--- FILE: " (8) + path (avg) + " ---\n" (6) + "--- END OF FILE: " (16) + path (avg) + " ---\n\n" (8)
        // Plus optional date line: "Last modified: DD.MM.YYYY HH:mm:ss\n" (~30 chars)
        const markerCharsPerFile = (8 + avgPathLength + 6 + 16 + avgPathLength + 8) + 30;
        const totalMarkerChars = markerCharsPerFile * filesCount;
        return Math.ceil(totalMarkerChars / DEFAULT_CHARS_PER_TOKEN);
    }

    /**
     * Calculate total tokens using dual-pass approach
     */
    public static calculateTotal(params: {
        fileTokens: Array<{ content: string; extension: string }>;
        tree: string;
        filesCount: number;
        includeHeader?: boolean;
    }): number {
        let total = 0;

        // Pass 1: Sum tokens from each file
        for (const file of params.fileTokens) {
            total += this.estimateForFile(file.content, file.extension);
        }

        // Pass 2: Add content markers
        total += this.estimateContentMarkers(params.filesCount);

        // Pass 3: Add tree structure tokens
        total += this.estimateTree(params.tree);

        // Pass 4: Add header tokens (if needed)
        if (params.includeHeader) {
            total += this.estimateHeader();
        }

        return total;
    }

    public static format(count: number): string {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
        return count.toString();
    }

    /**
     * Analyze files and identify the largest ones by token count
     */
    public static findLargestFiles(files: Array<{ path: string; content: string; extension: string }>, topN: number = 5): Array<{ path: string; tokens: number; sizeKB: number }> {
        const fileStats = files.map(f => ({
            path: f.path,
            tokens: this.estimateForFile(f.content, f.extension),
            sizeKB: Math.round(f.content.length / 1024 * 10) / 10
        }));

        return fileStats
            .sort((a, b) => b.tokens - a.tokens)
            .slice(0, topN);
    }

    /**
     * Format large files list for display
     */
    public static formatLargeFiles(largeFiles: Array<{ path: string; tokens: number; sizeKB: number }>): string {
        if (largeFiles.length === 0) return '';
        
        return largeFiles
            .map(f => `  • ${f.path} (~${this.format(f.tokens)} tokens, ${f.sizeKB} KB)`)
            .join('\n');
    }
}
