import * as path from 'path';
import * as fs from 'fs';

/**
 * Node in the dependency graph
 */
export interface DependencyNode {
    filePath: string;
    relativePath: string;
    imports: string[];  // Paths to imported files
    importedBy: string[];  // Paths to files that import this
    depth: number;  // Distance from entry points
}

/**
 * Dependency graph for file ordering
 * EA-04: Context-aware file ordering
 */
export class DependencyGraph {
    private nodes: Map<string, DependencyNode> = new Map<string, DependencyNode>();
    private entryPoints: Set<string> = new Set<string>();

    /**
     * Add a file to the graph
     */
    addFile(filePath: string, relativePath: string): void {
        if (!this.nodes.has(filePath)) {
            this.nodes.set(filePath, {
                filePath,
                relativePath,
                imports: [],
                importedBy: [],
                depth: Infinity
            });
        }
    }

    /**
     * Mark a file as an entry point
     */
    markAsEntryPoint(filePath: string): void {
        this.entryPoints.add(filePath);
        const node = this.nodes.get(filePath);
        if (node) {
            node.depth = 0;
        }
    }

    /**
     * Add an import relationship
     */
    addImport(fromFile: string, toFile: string): void {
        const fromNode = this.nodes.get(fromFile);
        const toNode = this.nodes.get(toFile);

        if (fromNode && toNode) {
            if (!fromNode.imports.includes(toFile)) {
                fromNode.imports.push(toFile);
            }
            if (!toNode.importedBy.includes(fromFile)) {
                toNode.importedBy.push(fromFile);
            }
        }
    }

    /**
     * Calculate depths from entry points using BFS
     */
    calculateDepths(): void {
        const queue: string[] = Array.from(this.entryPoints);
        const visited = new Set<string>(this.entryPoints);

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentNode = this.nodes.get(current);

            if (!currentNode) continue;

            // Files that import this file are one level deeper
            for (const importer of currentNode.importedBy) {
                const importerNode = this.nodes.get(importer);
                if (importerNode && !visited.has(importer)) {
                    importerNode.depth = Math.min(importerNode.depth, currentNode.depth + 1);
                    visited.add(importer);
                    queue.push(importer);
                }
            }
        }

        // Files not reachable from entry points get depth based on import chain
        for (const node of this.nodes.values()) {
            if (node.depth === Infinity) {
                node.depth = this.calculateDepthFromImports(node.filePath, new Set<string>());
            }
        }
    }

    /**
     * Calculate depth recursively for unreachable files
     */
    private calculateDepthFromImports(filePath: string, visited: Set<string>): number {
        if (visited.has(filePath)) return 0;
        visited.add(filePath);

        const node = this.nodes.get(filePath);
        if (!node || node.imports.length === 0) return 1000;  // Leaf file

        let minDepth = 1000;
        for (const imported of node.imports) {
            const importedNode = this.nodes.get(imported);
            if (importedNode) {
                const depth = this.calculateDepthFromImports(imported, new Set(visited));
                minDepth = Math.min(minDepth, depth + 1);
            }
        }

        return minDepth;
    }

    /**
     * Get files sorted by dependency order
     * Entry points first, then dependencies, then everything else
     */
    getSortedFiles(): string[] {
        this.calculateDepths();

        const sorted = Array.from(this.nodes.entries())
            .sort((a, b) => {
                // Entry points first
                if (this.entryPoints.has(a[0])) return -1;
                if (this.entryPoints.has(b[0])) return 1;

                // Then by depth (files with lower depth first)
                if (a[1].depth !== b[1].depth) {
                    return a[1].depth - b[1].depth;
                }

                // Then alphabetically
                return a[1].relativePath.localeCompare(b[1].relativePath);
            });

        return sorted.map(([filePath]) => filePath);
    }

    /**
     * Get the graph as a Mermaid diagram
     */
    toMermaidDiagram(): string {
        const lines: string[] = ['```mermaid', 'graph TD'];

        for (const [filePath, node] of this.nodes.entries()) {
            const nodeId = this.nodeId(filePath);
            const label = path.basename(filePath);
            const isEntry = this.entryPoints.has(filePath) ? ':::entryPoint' : '';
            lines.push(`    ${nodeId}["${label}"]${isEntry}`);
        }

        for (const [filePath, node] of this.nodes.entries()) {
            const nodeId = this.nodeId(filePath);
            for (const imported of node.imports) {
                const importedId = this.nodeId(imported);
                lines.push(`    ${nodeId} --> ${importedId}`);
            }
        }

        lines.push('    classDef entryPoint fill:#f96,stroke:#333,stroke-width:2px');
        lines.push('```');

        return lines.join('\n');
    }

    /**
     * Create a safe node ID for Mermaid
     */
    private nodeId(filePath: string): string {
        return 'n' + filePath.replace(/[^a-zA-Z0-9]/g, '_');
    }

    /**
     * Get statistics about the graph
     */
    getStats(): { total: number; entryPoints: number; maxDepth: number } {
        let maxDepth = 0;
        for (const node of this.nodes.values()) {
            if (node.depth !== Infinity) {
                maxDepth = Math.max(maxDepth, node.depth);
            }
        }

        return {
            total: this.nodes.size,
            entryPoints: this.entryPoints.size,
            maxDepth
        };
    }
}

/**
 * Import parser for different languages
 */
export class ImportParser {
    private static patterns: Record<string, RegExp[]> = {
        // TypeScript/JavaScript: import x from 'y', import('y'), require('y')
        '.ts': [
            /import\s+(?:type\s+)?(?:[\w{}\s,*]+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        '.js': [
            /import\s+(?:[\w{}\s,*]+)\s+from\s+['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        '.tsx': [
            /import\s+(?:type\s+)?(?:[\w{}\s,*]+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        '.jsx': [
            /import\s+(?:[\w{}\s,*]+)\s+from\s+['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],

        // Python: import x, from x import y
        '.py': [
            /from\s+([\w.]+)\s+import\s+/g,
            /import\s+([\w.]+)(?:\s+as\s+\w+)?/g,
        ],

        // Rust: use x::y, mod x
        '.rs': [
            /use\s+([\w:]+)::/g,
            /mod\s+(\w+)/g,
        ],

        // Go: import "x", import ( "x" )
        '.go': [
            /import\s+\(\s*([^)]+)\s*\)/g,
            /import\s+['"]([^'"]+)['"]/g,
        ],

        // PHP: use X, require, include
        '.php': [
            /use\s+([\w\\]+)/g,
            /require(?:_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /include(?:_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],

        // Ruby: require, include
        '.rb': [
            /require\s+['"]([^'"]+)['"]/g,
            /include\s+([\w:]+)/g,
        ],

        // Java: import x.y
        '.java': [
            /import\s+([\w.]+);/g,
        ],

        // C#: using X
        '.cs': [
            /using\s+([\w.]+);/g,
        ],
    };

    /**
     * Parse imports from file content
     */
    static parseImports(filePath: string, content: string): string[] {
        const ext = path.extname(filePath).toLowerCase();
        const patterns = this.patterns[ext] || [];
        const imports: string[] = [];

        for (const pattern of patterns) {
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(content)) !== null) {
                // Handle multi-import lines
                if (match[1]) {
                    const importPaths = match[1].split(',').map(s => s.trim());
                    for (const imp of importPaths) {
                        if (imp && !imp.startsWith('.')) {
                            imports.push(imp);
                        }
                    }
                }
            }
        }

        return [...new Set(imports)];  // Deduplicate
    }

    /**
     * Check if a file is likely an entry point
     */
    static isEntryPoint(filePath: string): boolean {
        const basename = path.basename(filePath).toLowerCase();
        const entryPointNames = [
            'index', 'main', 'app', 'entry', 'start', 'init',
            '__main__', 'cli', 'server', 'client',
            'program', 'bootstrap', 'launcher'
        ];

        const basenameNoExt = basename.replace(/\.[^.]+$/, '');
        return entryPointNames.some(name => basenameNoExt === name);
    }
}
