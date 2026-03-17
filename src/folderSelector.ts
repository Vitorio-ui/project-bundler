import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Folder item for selection dialog
 */
interface FolderItem extends vscode.QuickPickItem {
    fsPath: string;
    relativePath: string;
    selected: boolean;
    depth: number;
    isFolder: boolean;
    children?: FolderItem[];
}

/**
 * Interactive folder selection dialog
 * EA-07: Allows users to select which folders to include in bundle
 */
export class FolderSelectorDialog {
    private selectedFolders: Set<string> = new Set<string>();
    private allFolders: FolderItem[] = [];
    private quickPick: vscode.QuickPick<FolderItem>;

    constructor(
        private rootPath: string,
        private excludedFolders: Set<string>
    ) {
        this.quickPick = vscode.window.createQuickPick<FolderItem>();
        this.quickPick.canSelectMany = false;
        this.quickPick.ignoreFocusOut = true;
        this.quickPick.title = 'Select Folders to Include in Bundle';
        this.quickPick.placeholder = 'Toggle folders with Enter, click [Done] when ready';
    }

    /**
     * Scan and collect all folders from root
     */
    private async scanFolders(): Promise<void> {
        this.allFolders = [];

        const entries = await fs.promises.readdir(this.rootPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const folderPath = path.join(this.rootPath, entry.name);
                const relativePath = path.relative(this.rootPath, folderPath);

                // Skip excluded folders
                if (this.excludedFolders.has(entry.name)) {
                    continue;
                }

                // Skip common excluded folders
                if (this.isCommonExcludedFolder(entry.name)) {
                    continue;
                }

                const isSelected = !this.isCommonExcludedFolder(entry.name);

                const item: FolderItem = {
                    label: `${entry.name}/`,
                    description: relativePath,
                    fsPath: folderPath,
                    relativePath,
                    selected: isSelected,
                    depth: 0,
                    isFolder: true,
                    children: []
                };

                // Scan subfolders recursively (max depth 3)
                await this.scanSubFolders(folderPath, item, 1);

                this.allFolders.push(item);
            }
        }

        // Sort alphabetically
        this.allFolders.sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * Recursively scan subfolders
     */
    private async scanSubFolders(parentPath: string, parentItem: FolderItem, depth: number): Promise<void> {
        if (depth > 3) return; // Max depth limit

        try {
            const entries = await fs.promises.readdir(parentPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const folderPath = path.join(parentPath, entry.name);
                    const relativePath = path.relative(this.rootPath, folderPath);

                    // Skip excluded folders
                    if (this.excludedFolders.has(entry.name) || this.isCommonExcludedFolder(entry.name)) {
                        continue;
                    }

                    const item: FolderItem = {
                        label: `${'  '.repeat(depth)}├─ ${entry.name}/`,
                        description: relativePath,
                        fsPath: folderPath,
                        relativePath,
                        selected: parentItem.selected, // Inherit parent selection
                        depth,
                        isFolder: true,
                        children: []
                    };

                    parentItem.children!.push(item);

                    // Continue scanning
                    await this.scanSubFolders(folderPath, item, depth + 1);
                }
            }
        } catch (e) {
            // Ignore permission errors
        }
    }

    /**
     * Check if folder is commonly excluded
     */
    private isCommonExcludedFolder(name: string): boolean {
        const excluded = [
            'node_modules',
            'dist',
            'build',
            'target',
            'vendor',
            '.git',
            '.svn',
            '.hg',
            'coverage',
            '.nyc_output',
            'venv',
            '.venv',
            '__pycache__',
            '.pytest_cache',
            'bin',
            'obj',
            'out',
            'logs',
            'tmp',
            'temp'
        ];
        return excluded.includes(name.toLowerCase());
    }

    /**
     * Show the folder selection dialog
     * Returns array of selected folder paths
     */
    public async show(): Promise<string[] | null> {
        await this.scanFolders();

        // Initialize selected folders set
        for (const folder of this.allFolders) {
            if (folder.selected) {
                this.selectedFolders.add(folder.fsPath);
            }
        }

        this.updateQuickPickItems();

        this.quickPick.show();

        return new Promise<string[] | null>((resolve) => {
            let isDone = false;

            // Handle folder toggle via Enter key
            this.quickPick.onDidAccept(() => {
                const selectedItem = this.quickPick.selectedItems[0];

                if (!selectedItem) {
                    return;
                }

                const folderItem = selectedItem as FolderItem;

                // Action buttons (depth -1) are handled by onDidChangeSelection
                if (folderItem.depth === -1) {
                    return;
                }

                // Toggle selection
                folderItem.selected = !folderItem.selected;
                this.toggleFolderSelection(folderItem, folderItem.selected);

                // Update UI to reflect new checkbox state
                this.updateQuickPickItems();

                // Clear selection to prevent re-triggering
                this.quickPick.selectedItems = [];
            });

            // Handle action button clicks
            this.quickPick.onDidChangeSelection((items) => {
                if (items.length === 0) return;

                const selectedItem = items[0] as FolderItem;

                // Only handle action buttons (depth -1)
                if (selectedItem.depth === -1) {
                    if (selectedItem.label.includes('Select All')) {
                        this.selectAll();
                    } else if (selectedItem.label.includes('Deselect All')) {
                        this.deselectAll();
                    } else if (selectedItem.label.includes('Reset')) {
                        this.resetSelection();
                    } else if (selectedItem.label.includes('✓ Done')) {
                        // Done clicked - resolve with selected folders
                        isDone = true;
                        resolve(this.getSelectedFolders());
                        this.quickPick.hide();
                        return;
                    }

                    // Clear selection after action button click
                    this.quickPick.selectedItems = [];
                }
            });

            // Handle dialog close (Escape or window close)
            this.quickPick.onDidHide(() => {
                if (!isDone) {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Toggle folder selection recursively
     */
    private toggleFolderSelection(item: FolderItem, selected: boolean): void {
        if (selected) {
            this.selectedFolders.add(item.fsPath);
        } else {
            this.selectedFolders.delete(item.fsPath);
        }

        // Update the item's selected state
        item.selected = selected;

        // Toggle children
        if (item.children) {
            for (const child of item.children) {
                this.toggleFolderSelection(child, selected);
            }
        }
    }

    /**
     * Update QuickPick items with current selection state
     */
    private updateQuickPickItems(): void {
        const items: FolderItem[] = [];

        // Add action buttons at top
        const selectAllItem: FolderItem = {
            label: '$(check-all) Select All',
            description: 'Select all folders',
            fsPath: '',
            relativePath: '',
            selected: false,
            depth: -1,
            isFolder: false
        };

        const deselectAllItem: FolderItem = {
            label: '$(clear-all) Deselect All',
            description: 'Deselect all folders',
            fsPath: '',
            relativePath: '',
            selected: false,
            depth: -1,
            isFolder: false
        };

        const resetItem: FolderItem = {
            label: '$(refresh) Reset to Default',
            description: 'Reset selection to default (exclude common folders)',
            fsPath: '',
            relativePath: '',
            selected: false,
            depth: -1,
            isFolder: false
        };

        const doneItem: FolderItem = {
            label: '$(check) ✓ Done',
            description: `Create bundle with ${this.selectedFolders.size} folders`,
            fsPath: '',
            relativePath: '',
            selected: false,
            depth: -1,
            isFolder: false
        };

        items.push(selectAllItem, deselectAllItem, resetItem, doneItem);
        items.push({
            label: '──────────',
            description: '',
            fsPath: '',
            relativePath: '',
            selected: false,
            depth: -1,
            isFolder: false
        } as FolderItem);

        // Add folders
        for (const folder of this.allFolders) {
            items.push(this.createFolderItem(folder));
            if (folder.children && folder.children.length > 0) {
                for (const child of folder.children) {
                    items.push(this.createFolderItem(child));
                    // Add grandchildren if any
                    if (child.children && child.children.length > 0) {
                        for (const grandchild of child.children) {
                            items.push(this.createFolderItem(grandchild));
                        }
                    }
                }
            }
        }

        this.quickPick.items = items;
    }

    /**
     * Create QuickPick item with checkbox icon
     */
    private createFolderItem(folder: FolderItem): FolderItem {
        const icon = folder.selected ? '$(check)' : '$(circle-outline)';
        return {
            ...folder,
            label: `${icon} ${folder.label}`
        };
    }

    /**
     * Select all folders
     */
    private selectAll(): void {
        for (const folder of this.allFolders) {
            this.toggleFolderSelection(folder, true);
        }
        this.updateQuickPickItems();
    }

    /**
     * Deselect all folders
     */
    private deselectAll(): void {
        for (const folder of this.allFolders) {
            this.toggleFolderSelection(folder, false);
        }
        this.updateQuickPickItems();
    }

    /**
     * Reset selection to default
     */
    private resetSelection(): void {
        this.selectedFolders.clear();

        for (const folder of this.allFolders) {
            const isSelected = !this.isCommonExcludedFolder(path.basename(folder.fsPath));
            this.toggleFolderSelection(folder, isSelected);
        }

        this.updateQuickPickItems();
    }

    /**
     * Get selected folder paths
     */
    public getSelectedFolders(): string[] {
        return Array.from(this.selectedFolders);
    }
}
