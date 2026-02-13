import * as vscode from 'vscode';
import { IgnoreEngine } from './ignoreEngine';
import { generateBundle } from './bundler';
import { t } from './i18n';
import { LicenseManager } from './licenseManager';

export function activate(context: vscode.ExtensionContext) {
    
    const licenseManager = new LicenseManager(context);

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.enterLicense', async () => {
        await licenseManager.promptForLicense();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.resetLicense', async () => {
        await licenseManager.resetLicense();
        vscode.window.showInformationMessage('Limits reset.');
    }));

    const runBundler = async (selectedFiles?: vscode.Uri[]) => {
        // Поддержка Multi-root workspace: берем тот проект, которому принадлежит первый выбранный файл
        let rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        
        if (selectedFiles && selectedFiles.length > 0) {
            const workspace = vscode.workspace.getWorkspaceFolder(selectedFiles[0]);
            if (workspace) {
                rootPath = workspace.uri.fsPath;
            }
        }

        if (!rootPath) {
            vscode.window.showErrorMessage(t('errorRoot'));
            return;
        }

        const config = vscode.workspace.getConfiguration('projectBundler');
        const alwaysFullTree = config.get('includeFullTree', true);
        const maxFilesWarning = config.get('maxFiles', 10000) as number;
        
        // Создаем движок с учетом новых настроек
        const ignoreEngine = new IgnoreEngine(rootPath);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Context Builder",
            cancellable: false
        }, async (progress) => {
            
            // 1. Сборка БАЗОВОГО ДЕРЕВА (все, что не игнорируется)
            let treeFiles: vscode.Uri[] = [];
            if (alwaysFullTree) {
                progress.report({ message: t('scan') });
                const allFiles = await vscode.workspace.findFiles('**/*', null, maxFilesWarning + 1000);
                treeFiles = allFiles.filter(f => !ignoreEngine.isIgnored(f.fsPath));
            }

            // 2. Сборка КОНТЕНТА (Выбранное пользователем)
            let contentFiles: vscode.Uri[] = [];
            if (selectedFiles && selectedFiles.length > 0) {
                progress.report({ message: t('scanSelected') });
                for (const uri of selectedFiles) {
                    const stats = await vscode.workspace.fs.stat(uri);
                    if (stats.type === vscode.FileType.Directory) {
                        const pattern = new vscode.RelativePattern(uri, '**/*');
                        const folderFiles = await vscode.workspace.findFiles(pattern);
                        // Для папок мы применяем фильтр, чтобы не тащить мусор
                        contentFiles.push(...folderFiles.filter(f => !ignoreEngine.isIgnored(f.fsPath)));
                    } else {
                        // ВАЖНО: Если выбран конкретный файл, мы его добавляем, даже если он ignored!
                        // (Пользователь лучше знает, что ему нужно)
                        contentFiles.push(uri);
                    }
                }
                
                // Если FullTree выключен, дерево = только выбранные файлы
                if (!alwaysFullTree) treeFiles = [...contentFiles];
            } else {
                // Если ничего не выбрано -> берем всё неигнорируемое
                progress.report({ message: t('scan') });
                if (treeFiles.length === 0) {
                    const allFiles = await vscode.workspace.findFiles('**/*', null, maxFilesWarning + 1000);
                    treeFiles = allFiles.filter(f => !ignoreEngine.isIgnored(f.fsPath));
                }
                contentFiles = treeFiles;
            }

            // --- SMART PATH MERGE ---
            // Добавляем contentFiles в treeFiles, чтобы гарантировать, что путь к ним будет отрисован,
            // даже если родительская папка была исключена из базового сканирования.
            // Используем Set строковых путей для удаления дубликатов.
            const uniquePaths = new Set(treeFiles.map(u => u.fsPath));
            contentFiles.forEach(u => uniquePaths.add(u.fsPath));
            
            // Превращаем обратно в Uri (немного костыльно, но надежно)
            treeFiles = Array.from(uniquePaths).map(p => vscode.Uri.file(p));
            // ------------------------

            // Проверка лимитов
            const allowed = await licenseManager.checkLimits(contentFiles);
            if (!allowed) return; 

            progress.report({ message: "Packing bundle..." });
            const finalContent = await generateBundle(rootPath, treeFiles, contentFiles);

            const doc = await vscode.workspace.openTextDocument({ content: finalContent, language: 'markdown' });
            await vscode.window.showTextDocument(doc);
            
            await vscode.env.clipboard.writeText(finalContent);
            vscode.window.showInformationMessage(t('done'));
        });
    };

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.runWorkspaceBundle', () => runBundler()));
    
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleSelected', (uri: vscode.Uri, allUris: vscode.Uri[]) => {
        const targets = allUris && allUris.length > 0 ? allUris : [uri];
        runBundler(targets);
    }));
}