import * as vscode from 'vscode';
import { IgnoreEngine } from './ignoreEngine';
import { generateBundle } from './bundler';
import { t } from './i18n';
import { LicenseManager } from './licenseManager';
import { PresetEngine, PresetType } from './presetEngine';

interface BundlerOptions {
    smartTree: boolean;
    preset: PresetType;
}

export function activate(context: vscode.ExtensionContext) {
    const licenseManager = new LicenseManager(context);

    // --- Dev / Reset Commands ---
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.devToggle', async () => {
        await licenseManager.toggleDevProMode();
    }));

    // Добавляем команду сброса состояния (полезно для юзеров, если нажали не туда)
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.resetState', async () => {
        await licenseManager.resetState();
    }));

    const runBundler = async (targets: vscode.Uri[], options: BundlerOptions) => {
        // ... (код получения rootPath и конфига) ...
        let rootPath: string | undefined;
        if (targets.length > 0) {
            const workspace = vscode.workspace.getWorkspaceFolder(targets[0]);
            rootPath = workspace?.uri.fsPath;
        } else {
            rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        }
        if (!rootPath) { vscode.window.showErrorMessage(t('errorRoot')); return; }

        const config = vscode.workspace.getConfiguration('projectBundler');
        const maxFilesWarning = config.get('maxFiles', 10000) as number;
        const userSmartSetting = config.get('smartTree', true);
        
        // --- LOGIC GATES ---

        let useSmartTree = false;
        
        // 1. Проверяем Smart Tree (Early Access Gate)
        if (options.preset !== PresetType.Full && (options.smartTree && userSmartSetting)) {
            const allowed = await licenseManager.checkEarlyAccess("Smart Tree Compression");
            if (!allowed) {
                // Если отказался, продолжаем, но БЕЗ smart tree
                useSmartTree = false; 
            } else {
                useSmartTree = true;
            }
        }

        // 2. Проверяем Пресеты (Strict Gate)
        if (options.preset === PresetType.Minimal || options.preset === PresetType.Architecture) {
            const allowed = await licenseManager.checkStrictPro(`${options.preset} Preset`);
            if (!allowed) return; // Прерываем выполнение
        }

        const ignoreEngine = new IgnoreEngine(rootPath);
        const presetEngine = new PresetEngine(ignoreEngine, rootPath);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Project Bundler",
            cancellable: false
        }, async (progress) => {
            
            progress.report({ message: t('scan') });
            const allFilesRaw = await vscode.workspace.findFiles('**/*', null, maxFilesWarning + 1000);
            let treeFiles = allFilesRaw.filter(f => !ignoreEngine.isIgnored(f.fsPath));

            progress.report({ message: t('scanSelected') });
            const contentFiles = await presetEngine.getFiles(options.preset, targets);

            // Merge paths logic...
            const uniquePaths = new Set(treeFiles.map(u => u.fsPath));
            let addedNew = false;
            contentFiles.forEach(u => {
                if (!uniquePaths.has(u.fsPath)) {
                    uniquePaths.add(u.fsPath);
                    addedNew = true;
                }
            });
            if (addedNew) {
                treeFiles = Array.from(uniquePaths).map(p => vscode.Uri.file(p));
            }

            // Soft Limits Check (из предыдущего шага)
            // const limitsOk = await licenseManager.checkLimits(contentFiles);
            // if (!limitsOk) return;

            progress.report({ message: "Packing bundle..." });
            const finalContent = await generateBundle(rootPath!, treeFiles, contentFiles, useSmartTree);

            const doc = await vscode.workspace.openTextDocument({ content: finalContent, language: 'markdown' });
            await vscode.window.showTextDocument(doc);
            
            await vscode.env.clipboard.writeText(finalContent);
            vscode.window.showInformationMessage(t('done'));
        });
    };

    // --- COMMANDS ---

    // Free / Early Access
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleSelectedSmart', (uri: vscode.Uri, allUris: vscode.Uri[]) => {
        const targets = allUris && allUris.length > 0 ? allUris : (uri ? [uri] : []);
        runBundler(targets, { smartTree: true, preset: PresetType.Selected });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleFull', () => {
        runBundler([], { smartTree: false, preset: PresetType.Full });
    }));

    // Pro Presets (Strict Gate)
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleMinimal', async () => {
        // Передаем targets пустые, так как пресеты обычно работают от корня, 
        // но если логика изменится, можно передавать контекст
        runBundler([], { smartTree: true, preset: PresetType.Minimal });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleArch', async () => {
        runBundler([], { smartTree: true, preset: PresetType.Architecture });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.enterLicense', async () => {
        await licenseManager.promptForLicense();
    }));
}