import * as path from 'path';

interface TreeNode {
    name: string;
    path: string;
    isFile: boolean;
    children: TreeNode[];
    hasSelectedContent: boolean;
    isSelected: boolean;     // NEW: узел сам является выбранным
    isContextNode: boolean;  // NEW: попадает в радиус ±2 от выбранного
}

export interface TreeOptions {
    rootPath: string;
    allFilePaths: string[];
    selectedPaths: Set<string>;
    smartCompression: boolean;
}

export class TreeGenerator {
    private root: TreeNode;

    private normalizedSelected: Set<string>;

    constructor(private options: TreeOptions) {
        this.root = { name: path.basename(options.rootPath), path: '', isFile: false,
            children: [], hasSelectedContent: false, isSelected: false, isContextNode: false };
        // Нормализуем selectedPaths к '/' один раз, чтобы не было проблем
        // с path.sep на разных ОС и при edge-case'ах в именах файлов
        this.normalizedSelected = new Set(
            [...options.selectedPaths].map(p => p.split(path.sep).join('/'))
        );
        this.buildTree();
    }

    private buildTree() {
        const nodeMap = new Map<string, TreeNode>();
        nodeMap.set('', this.root);

        for (const filePath of this.options.allFilePaths) {
            // Все пути храним через '/' для консистентности
            const parts = filePath.split(path.sep).join('/').split('/');
            let parentNode = this.root;

            for (let i = 0; i < parts.length; i++) {
                const currentPath = parts.slice(0, i + 1).join('/');
                let currentNode = nodeMap.get(currentPath);
                if (!currentNode) {
                    const isFile = i === parts.length - 1;
                    currentNode = { name: parts[i], path: currentPath, isFile, children: [],
                        hasSelectedContent: false, isSelected: false, isContextNode: false };
                    parentNode.children.push(currentNode);
                    nodeMap.set(currentPath, currentNode);
                }
                parentNode = currentNode;
            }
        }

        for (const selectedPath of this.normalizedSelected) {
            const parts = selectedPath.split('/');
            let currentPath = '';
            for (let i = 0; i < parts.length; i++) {
                currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
                const node = nodeMap.get(currentPath);
                if (node) {
                    node.hasSelectedContent = true;
                    if (i === parts.length - 1) node.isSelected = true;
                }
            }
        }

        this.markContextSiblings(this.root);
    }

    private sortedChildren(node: TreeNode): TreeNode[] {
        return [...node.children].sort((a, b) => {
            if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    private markContextSiblings(node: TreeNode) {
        if (node.children.length === 0) return;
        const sorted = this.sortedChildren(node);
        const RADIUS = 2;

        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].isSelected || sorted[i].hasSelectedContent) {
                const lo = Math.max(0, i - RADIUS);
                const hi = Math.min(sorted.length - 1, i + RADIUS);
                for (let j = lo; j <= hi; j++) {
                    sorted[j].isContextNode = true;
                }
            }
        }

        for (const child of node.children) {
            if (!child.isFile) {
                this.markContextSiblings(child);
            }
        }
    }

    public generate(): string {
        const rootPath = this.options.rootPath;

        // Если rootPath — это корень диска ('/' или 'C:\'), показываем детей напрямую
        if (path.parse(rootPath).root === rootPath) {
            return this.renderNode(this.root, '', true);
        }

        // Иначе — показываем все компоненты пути как вложенное дерево
        const parts = rootPath.split(path.sep).filter(p => p.length > 0);
        let output = '';
        let indent = '';

        for (let i = 0; i < parts.length; i++) {
            const isLast = i === parts.length - 1;
            output += `${indent}${isLast ? '└── ' : '├── '}${parts[i]}/\n`;
            indent += isLast ? '    ' : '│   ';
        }

        output += this.renderNode(this.root, indent, true);
        return output;
    }

    private countDescendants(node: TreeNode): { folders: number; files: number } {
        if (node.isFile) return { folders: 0, files: 1 };
        const stats = { folders: 0, files: 0 };
        for (const child of node.children) {
            if (child.isFile) {
                stats.files++;
            } else {
                stats.folders++;
                const s = this.countDescendants(child);
                stats.folders += s.folders;
                stats.files += s.files;
            }
        }
        return stats;
    }

    private makeFolderSummary(folders: number, files: number): string {
        return folders > 0
            ? `(${folders} folders, ${files} files hidden)`
            : `(${files} files hidden)`;
    }

    private static readonly BATCH_THRESHOLD = 4; // Fix 2: было 2

    private renderNode(node: TreeNode, prefix: string, isRoot: boolean): string {
        // collapsed-логика теперь живёт только в renderChildren и в visible-блоке ниже
        const children = this.sortedChildren(node);
        if (!this.options.smartCompression || isRoot) {
            return this.renderChildren(children, prefix);
        }

        // Строим список RenderItem-ов в алфавитном порядке.
        // Последовательные холодные узлы накапливаются в батч и флашатся
        // как только встречается горячий узел — так батч стоит на своём месте.
        type RenderItem =
            | { kind: 'node'; node: TreeNode }
            | { kind: 'batch'; folders: number; files: number; folderNames: string[] };

        const renderItems: RenderItem[] = [];
        let batchFolders = 0, batchFiles = 0;
        let batchFolderNames: string[] = [], batchNodes: TreeNode[] = [];

        const flushBatch = () => {
            if (batchNodes.length === 0) return;
            if (batchNodes.length < TreeGenerator.BATCH_THRESHOLD) {
                // Мало скрытых — показываем поштучно с [excluded]
                for (const n of batchNodes) renderItems.push({ kind: 'node', node: n });
            } else {
                renderItems.push({ kind: 'batch', folders: batchFolders, files: batchFiles,
                    folderNames: batchFolderNames });
            }
            batchFolders = 0; batchFiles = 0; batchFolderNames = []; batchNodes = [];
        };

        for (const child of children) {
            const isVisible = child.isSelected || child.hasSelectedContent || child.isContextNode;
            if (isVisible) {
                flushBatch();
                renderItems.push({ kind: 'node', node: child });
            } else {
                batchNodes.push(child);
                if (child.isFile) {
                    batchFiles++;
                } else {
                    batchFolderNames.push(child.name);
                    const s = this.countDescendants(child);
                    batchFolders += 1 + s.folders;
                    batchFiles += s.files;
                }
            }
        }
        flushBatch(); // последний батч (если children заканчивались холодными)

        const MAX_NAMES = 3;
        let output = '';

        for (let i = 0; i < renderItems.length; i++) {
            const item = renderItems[i];
            const isLast = i === renderItems.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = prefix + (isLast ? '    ' : '│   ');

            if (item.kind === 'batch') {
                let batchLine = '... ';
                if (item.folderNames.length > 0) {
                    const shown = item.folderNames.slice(0, MAX_NAMES).map(n => `${n}/`).join(', ');
                    const extra = item.folderNames.length > MAX_NAMES
                        ? ` +${item.folderNames.length - MAX_NAMES} more` : '';
                    batchLine += `${shown}${extra} `;
                }
                batchLine += this.makeFolderSummary(item.folders, item.files);
                output += `${prefix}${connector}${batchLine}\n`;
            } else {
                const child = item.node;
                if (child.isFile) {
                    const isSelected = this.normalizedSelected.has(child.path);
                    output += `${prefix}${connector}${child.name}${isSelected ? '' : ' [excluded]'}\n`;
                } else if (!child.hasSelectedContent) {
                    const s = this.countDescendants(child);
                    output += `${prefix}${connector}${child.name}/ ${this.makeFolderSummary(s.folders, s.files)}\n`;
                } else {
                    output += `${prefix}${connector}${child.name}/\n`;
                    output += this.renderNode(child, childPrefix, false);
                }
            }
        }
        return output;
    }

    private renderChildren(children: TreeNode[], prefix: string): string {
        let output = '';
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const isLast = i === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = prefix + (isLast ? '    ' : '│   ');

            if (child.isFile) {
                const isSelected = this.normalizedSelected.has(child.path);
                output += `${prefix}${connector}${child.name}${isSelected ? '' : ' [excluded]'}\n`;
            } else if (this.options.smartCompression && !child.hasSelectedContent) {
                // Холодная папка — коллапсируем ЗДЕСЬ, без вызова renderNode
                const s = this.countDescendants(child);
                output += `${prefix}${connector}${child.name}/ ${this.makeFolderSummary(s.folders, s.files)}\n`;
            } else {
                output += `${prefix}${connector}${child.name}/\n`;
                output += this.renderNode(child, childPrefix, false);
            }
        }
        return output;
    }
}