import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { t } from './i18n';

export async function generateBundle(
    rootPath: string, 
    treeFiles: vscode.Uri[], 
    contentFiles: vscode.Uri[]
): Promise<string> {
    
    const config = vscode.workspace.getConfiguration('projectBundler');
    const binaryExtensions = new Set(config.get('binaryExtensions', []) as string[]);

    // --- ИСПРАВЛЕНИЕ 1: НАТУРАЛЬНАЯ СОРТИРОВКА КОНТЕНТА ---
    contentFiles.sort((a, b) => {
        return a.fsPath.localeCompare(b.fsPath, undefined, { numeric: true, sensitivity: 'base' });
    });
    // -----------------------------------------------------

    const contentPathsSet = new Set(
        contentFiles.map(f => path.relative(rootPath, f.fsPath))
    );

    let output = `PROJECT BUNDLE | ${path.basename(rootPath)}\n`;
    output += `${t('generated')}: ${new Date().toLocaleString()}\n`;
    const modeText = treeFiles.length === contentFiles.length ? t('modeFull') : t('modeTree');
    output += `${t('mode')}: ${modeText}\n\n`;
    
    output += `================================================================================\n`;
    output += `${t('structure')}\n`;
    output += `(${t('legend')})\n\n`;

    const treePaths = treeFiles.map(f => path.relative(rootPath, f.fsPath)); 
    // Сортировка treePaths происходит внутри renderTree, так что здесь можно не сортировать
    
    output += renderTree(treePaths, contentPathsSet);
    
    output += `\n================================================================================\n`;
    output += `${t('contents')} (${contentFiles.length} files)\n\n`;

    for (const fileUri of contentFiles) {
        const relativePath = path.relative(rootPath, fileUri.fsPath);
        const ext = path.extname(fileUri.fsPath).toLowerCase();

        output += `--- FILE: ${relativePath} ---\n`;
        
        if (binaryExtensions.has(ext)) {
            output += `[Binary file or excluded extension: ${ext} - Content skipped]\n`;
        } else {
            try {
                const content = await fs.readFile(fileUri.fsPath, 'utf8');
                if (content.includes('\0')) {
                     output += `[Binary content detected - skipped]\n`;
                } else {
                    output += content + (content.endsWith('\n') ? '' : '\n');
                }
            } catch (err) {
                output += `[Error reading file: ${err}]\n`;
            }
        }
        output += `--- END OF FILE: ${relativePath} ---\n\n`;
    }

    return output;
}

function renderTree(paths: string[], contentSet: Set<string>): string {
    let tree = '';
    const treeObj: any = {};

    paths.forEach(p => {
        let current = treeObj;
        const parts = p.split(path.sep);
        parts.forEach((part, index) => {
            if (!current[part]) { 
                current[part] = { 
                    __isNode: true, 
                    __fullPath: parts.slice(0, index + 1).join(path.sep) 
                }; 
            }
            current = current[part];
        });
    });

    const build = (obj: any, prefix = '') => {
        // --- ИСПРАВЛЕНИЕ 2: НАТУРАЛЬНАЯ СОРТИРОВКА ДЕРЕВА ---
        const keys = Object.keys(obj)
            .filter(k => !k.startsWith('__'))
            .sort((a, b) => {
                // Магия: numeric: true заставляет '2' идти перед '10'
                return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            });
        // ----------------------------------------------------
        
        keys.forEach((key, index) => {
            const isLast = index === keys.length - 1;
            const node = obj[key];
            const fullPath = node['__fullPath'];
            const children = Object.keys(node).filter(k => !k.startsWith('__'));
            const isFile = children.length === 0;

            let suffix = '';
            if (isFile && fullPath && !contentSet.has(fullPath)) {
                suffix = ` [${t('excluded')}]`;
            }

            tree += `${prefix}${isLast ? '└── ' : '├── '}${key}${suffix}\n`;
            build(node, `${prefix}${isLast ? '    ' : '│   '}`);
        });
    };

    build(treeObj);
    return tree;
}