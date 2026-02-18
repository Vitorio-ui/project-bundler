/* --- src/treeGenerator.ts --- */

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
    private readonly CONTEXT_RADIUS = 2; // ±2 файла вокруг выбранного

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
        for (const filePath of this.options.allFilePaths) {
            const parts = filePath.split(path.sep);
            let currentNode = this.root;
            const isSelected = this.options.selectedPaths.has(filePath);
            if (isSelected) currentNode.hasSelectedContent = true;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;
                const currentPath = parts.slice(0, i + 1).join(path.sep);

                let child = currentNode.children.find(c => c.name === part);
                if (!child) {
                    child = { name: part, path: currentPath, isFile, children: [], hasSelectedContent: false };
                    currentNode.children.push(child);
                }
                if (isSelected) child.hasSelectedContent = true;
                currentNode = child;
            }
        }
    }

    public generate(): string {
        return this.renderNode(this.root, '', true);
    }
    
    // Исправленный, более простой счетчик
    private countDescendants(node: TreeNode): { folders: number, files: number } {
        if (node.isFile) {
            return { folders: 0, files: 1 };
        }
        const stats = { folders: 0, files: 0 };
        for (const child of node.children) {
            if (child.isFile) {
                stats.files++;
            } else {
                stats.folders++;
                const childStats = this.countDescendants(child);
                stats.folders += childStats.folders;
                stats.files += childStats.files;
            }
        }
        return stats;
    }

    private renderNode(node: TreeNode, prefix: string, isRoot: boolean): string {
        let output = '';
        
        const children = [...node.children].sort((a, b) => {
            if (a.isFile === b.isFile) return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            return a.isFile ? 1 : -1;
        });

        // 1. Определяем, какие элементы показывать
        const visibleIndices = new Set<number>();
        if (this.options.smartCompression && !isRoot) {
            children.forEach((child, idx) => {
                if (child.hasSelectedContent) { // Активные дети всегда видны
                    visibleIndices.add(idx);
                }
                if (child.isFile && this.options.selectedPaths.has(child.path)) {
                    for (let r = -this.CONTEXT_RADIUS; r <= this.CONTEXT_RADIUS; r++) {
                        const targetIdx = idx + r;
                        if (targetIdx >= 0 && targetIdx < children.length) {
                            visibleIndices.add(targetIdx);
                        }
                    }
                }
            });
        } else {
            children.forEach((_, idx) => visibleIndices.add(idx)); // Показываем всё в корне или если сжатие выключено
        }

        const visibleItems = children.filter((_, idx) => visibleIndices.has(idx));
        const hiddenItems = children.filter((_, idx) => !visibleIndices.has(idx));

        // 2. Рендерим видимые элементы
        for (let i = 0; i < visibleItems.length; i++) {
            const child = visibleItems[i];
            const isLast = (i === visibleItems.length - 1) && (hiddenItems.length === 0);
            const connector = isLast ? '└── ' : '├── ';

            if (child.isFile) {
                const isSelected = this.options.selectedPaths.has(child.path);
                output += `${prefix}${connector}${child.name}${isSelected ? '' : ' [excluded]'}\n`;
            } else { // Папка
                if (child.hasSelectedContent) {
                    // Активная папка - рекурсивно рендерим её содержимое
                    output += `${prefix}${connector}${child.name}/\n`;
                    output += this.renderNode(child, prefix + (isLast ? '    ' : '│   '), false);
                } else {
                    // Неактивная папка (но видимая из-за соседства) - сворачиваем в одну строку
                    const stats = this.countDescendants(child);
                    const summary = stats.folders > 0 
                        ? `(${stats.folders} folders, ${stats.files} files hidden)` 
                        : `(${stats.files} files hidden)`;
                    output += `${prefix}${connector}${child.name}/ ${summary}\n`;
                }
            }
        }
        
        // 3. Рендерим сводку по скрытым элементам
        if (hiddenItems.length > 0) {
            let hiddenFiles = 0, hiddenFolders = 0;
            hiddenItems.forEach(item => {
                const stats = this.countDescendants(item);
                hiddenFiles += stats.files;
                hiddenFolders += item.isFile ? 0 : (stats.folders + 1);
            });
            const summary = hiddenFolders > 0 
                ? `... (${hiddenFolders} folders, ${hiddenFiles} files hidden)` 
                : `... (${hiddenFiles} files hidden)`;
            output += `${prefix}└── ${summary}\n`;
        }
        
        return output;
    }
}