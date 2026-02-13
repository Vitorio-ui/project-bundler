import * as vscode from 'vscode';
import { IgnoreEngine } from './ignoreEngine';
import { generateBundle } from './bundler';
import { t } from './i18n';
import { LicenseManager } from './licenseManager';

export function activate(context: vscode.ExtensionContext) {
    
    const licenseManager = new LicenseManager(context);

    // Команда ввода лицензии (пока показывает "Coming Soon")
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.enterLicense', async () => {
        await licenseManager.promptForLicense();
    }));

    // Команда сброса (скрытая, для отладки)
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.resetLicense', async () => {
        await licenseManager.resetLicense();
        vscode.window.showInformationMessage('Usage limits reset (Debug).');
    }));

    const runBundler = async (selectedFiles?: vscode.Uri[]) => {
        const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!rootPath) {
            vscode.window.showErrorMessage(t('errorRoot'));
            return;
        }

        const config = vscode.workspace.getConfiguration('projectBundler');
        const alwaysFullTree = config.get('includeFullTree', true);
        const maxFilesWarning = config.get('maxFiles', 10000) as number;
        const ignoreEngine = new IgnoreEngine(rootPath);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Project Bundler",
            cancellable: false
        }, async (progress) => {
            
            // 1. Дерево
            let treeFiles: vscode.Uri[] = [];
            if (alwaysFullTree) {
                progress.report({ message: t('scan') });
                const allFiles = await vscode.workspace.findFiles('**/*', null, maxFilesWarning + 1000);
                treeFiles = allFiles.filter(f => !ignoreEngine.isIgnored(f.fsPath));
            }

            // 2. Контент
            let contentFiles: vscode.Uri[] = [];
            if (selectedFiles && selectedFiles.length > 0) {
                progress.report({ message: t('scanSelected') });
                for (const uri of selectedFiles) {
                    const stats = await vscode.workspace.fs.stat(uri);
                    if (stats.type === vscode.FileType.Directory) {
                        const pattern = new vscode.RelativePattern(uri, '**/*');
                        const folderFiles = await vscode.workspace.findFiles(pattern);
                        contentFiles.push(...folderFiles);
                    } else {
                        contentFiles.push(uri);
                    }
                }
                contentFiles = contentFiles.filter(f => !ignoreEngine.isIgnored(f.fsPath));
                if (!alwaysFullTree) treeFiles = contentFiles;
            } else {
                progress.report({ message: t('scan') });
                if (treeFiles.length === 0) {
                    const allFiles = await vscode.workspace.findFiles('**/*', null, maxFilesWarning + 1000);
                    treeFiles = allFiles.filter(f => !ignoreEngine.isIgnored(f.fsPath));
                }
                contentFiles = treeFiles;
            }

            // --- ПРОВЕРКА ЛИМИТОВ (SOFT) ---
            const allowed = await licenseManager.checkLimits(contentFiles);
            if (!allowed) return; 
            // -------------------------------

            progress.report({ message: "Packing bundle..." });
            const finalContent = await generateBundle(rootPath, treeFiles, contentFiles);

            const doc = await vscode.workspace.openTextDocument({ content: finalContent, language: 'markdown' });
            await vscode.window.showTextDocument(doc);
            
            // --- AUTO-COPY (ВКЛЮЧЕНО ДЛЯ ВСЕХ) ---
            await vscode.env.clipboard.writeText(finalContent);
            vscode.window.showInformationMessage(t('done'));
            // -------------------------------------
        });
    };

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.runWorkspaceBundle', () => runBundler()));
    
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleSelected', (uri: vscode.Uri, allUris: vscode.Uri[]) => {
        const targets = allUris && allUris.length > 0 ? allUris : [uri];
        runBundler(targets);
    }));
}