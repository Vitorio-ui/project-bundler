export class TokenStats {
    // Rough estimate: ~4 chars per token for English/Code
    private static readonly CHARS_PER_TOKEN = 3.8; 

    public static estimate(content: string): number {
        return Math.ceil(content.length / this.CHARS_PER_TOKEN);
    }

    public static format(count: number): string {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
        return count.toString();
    }
}