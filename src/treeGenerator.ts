import * as path from 'path';

interface TreeNode {
    name: string;
    path: string;
    isFile: boolean;
    children: TreeNode[];
    hasSelectedContent: boolean; 
}

export interface TreeOptions {
    rootPath: string;
    allFilePaths: string[];     
    selectedPaths: Set<string>; 
    smartCompression: boolean;  
}

export class TreeGenerator {
    private root: TreeNode;
    private readonly CONTEXT_RADIUS = 2; // ±2 files around a selected one

    constructor(private options: TreeOptions) {
        this.root = { 
            name: path.basename(options.rootPath), 
            path: '', 
            isFile: false, 
            children: [], 
            hasSelectedContent: false 
        };
        this.buildTree();
    }

    private buildTree() {
        // Build the tree structure and mark nodes that have selected content
        for (const filePath of this.options.allFilePaths) {
            const parts = filePath.split(path.sep);
            let currentNode = this.root;
            
            const isSelected = this.options.selectedPaths.has(filePath);
            if (isSelected) {
                currentNode.hasSelectedContent = true;
            }

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;
                const currentPath = parts.slice(0, i + 1).join(path.sep);

                let child = currentNode.children.find(c => c.name === part);
                if (!child) {
                    child = { 
                        name: part, 
                        path: currentPath, 
                        isFile, 
                        children: [],
                        hasSelectedContent: false
                    };
                    currentNode.children.push(child);
                }

                if (isSelected) {
                    child.hasSelectedContent = true;
                }
                currentNode = child;
            }
        }
    }

    public generate(): string {
        // Start rendering from the root's children, not the root itself.
        return this.renderNode(this.root, '', true);
    }
    
    private countDescendantFiles(node: TreeNode): number {
        if (node.isFile) {
            return 1;
        }
        return node.children.reduce((sum, child) => sum + this.countDescendantFiles(child), 0);
    }
    
    private renderNode(node: TreeNode, prefix: string, isRoot: boolean): string {
        let output = '';

        node.children.sort((a, b) => {
            if (a.isFile === b.isFile) {
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            }
            return a.isFile ? 1 : -1;
        });

        // Smart Compression Logic
        if (this.options.smartCompression && !node.hasSelectedContent && !isRoot) {
            const fileCount = this.countDescendantFiles(node);
            if (fileCount > 0) {
                return `${prefix}├── ${node.name}/ ... [collapsed: ${fileCount} files]\n`;
            }
            return ''; // Don't render empty, unselected folders
        }
        
        const childrenToRender = node.children;
        const visibleIndices = new Set<number>();

        if (this.options.smartCompression && !isRoot) {
            childrenToRender.forEach((child, index) => {
                // Directories with selected content are always visible
                if (!child.isFile && child.hasSelectedContent) {
                    visibleIndices.add(index);
                }
                // Selected files and their context are visible
                if (child.isFile && this.options.selectedPaths.has(child.path)) {
                    for (let i = -this.CONTEXT_RADIUS; i <= this.CONTEXT_RADIUS; i++) {
                        const contextIndex = index + i;
                        if (contextIndex >= 0 && contextIndex < childrenToRender.length) {
                            // only add files to context, not folders
                            if(childrenToRender[contextIndex].isFile) {
                                visibleIndices.add(contextIndex);
                            }
                        }
                    }
                }
            });
        }

        let hiddenFilesCount = 0;
        for (let i = 0; i < childrenToRender.length; i++) {
            const child = childrenToRender[i];
            const isLast = i === childrenToRender.length - 1;
            const connector = isLast ? '└── ' : '├── ';

            const shouldShow = !this.options.smartCompression || isRoot || child.hasSelectedContent || (child.isFile && visibleIndices.has(i));

            if (shouldShow) {
                if (hiddenFilesCount > 0) {
                    output += `${prefix}│   ... (${hiddenFilesCount} more files hidden)\n`;
                    hiddenFilesCount = 0;
                }

                let suffix = '';
                if (child.isFile && !this.options.selectedPaths.has(child.path)) {
                    suffix = ' [excluded]';
                }

                if (child.isFile) {
                    output += `${prefix}${connector}${child.name}${suffix}\n`;
                } else {
                    output += `${prefix}${connector}${child.name}/\n`;
                    output += this.renderNode(child, prefix + (isLast ? '    ' : '│   '), false);
                }
            } else {
                hiddenFilesCount++;
            }
        }
        if (hiddenFilesCount > 0) {
            output += `${prefix}    ... (${hiddenFilesCount} more files hidden)\n`;
        }

        return output;
    }
}