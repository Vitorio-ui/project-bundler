import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IgnoreEngine } from './ignoreEngine';
import { generateBundle } from './bundler';
import { t } from './i18n';
import { LicenseManager } from './licenseManager';
import { PresetEngine, PresetType } from './presetEngine';
import { FolderSelectorDialog } from './folderSelector';

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

        // --- ИСПРАВЛЕНИЕ: вычисляем rootPath как общего предка выбранных файлов ---
        let rootPath: string | undefined;

        if (targets.length > 0) {
            // Берём fsPath каждого target и разбиваем по sep
            const splitPaths = targets.map(u => u.fsPath.split(path.sep));
            // Находим общий префикс
            let common = splitPaths[0];
            for (const parts of splitPaths.slice(1)) {
                const len = Math.min(common.length, parts.length);
                let i = 0;
                while (i < len && common[i] === parts[i]) { i++; }
                common = common.slice(0, i);
            }
            const commonFsPath = common.join(path.sep);

            // Если общий путь — это файл, берём его директорию
            try {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(commonFsPath));
                rootPath = stat.type === vscode.FileType.Directory
                    ? commonFsPath
                    : path.dirname(commonFsPath);
            } catch {
                rootPath = path.dirname(commonFsPath);
            }
        } else {
            rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        }

        if (!rootPath) { vscode.window.showErrorMessage(t('errorRoot')); return; }

        const config = vscode.workspace.getConfiguration('projectBundler');
        const maxFilesWarning = config.get('maxFiles', 10000) as number;
        const userSmartSetting = config.get('smartTree', true);
        const autoSave = config.get('autoSave', false) as boolean;

        // --- LOGIC GATES ---

        let useSmartTree = false;

        // 1. Проверяем Smart Tree (Early Access Gate)
        if (options.preset !== PresetType.Full && (options.smartTree && userSmartSetting)) {
            const allowed = await licenseManager.checkEarlyAccess("Smart Tree Compression");
            useSmartTree = allowed;
        }

        // 2. Проверяем Пресеты (Early Access Gate)
        if (options.preset === PresetType.Minimal || options.preset === PresetType.Architecture || options.preset === PresetType.Debug) {
            const allowed = await licenseManager.checkEarlyAccess(`${options.preset} Preset`);
            if (!allowed) { return; }
        }

        const ignoreEngine = new IgnoreEngine(rootPath);
        const presetEngine = new PresetEngine(ignoreEngine, rootPath);

        // Load and merge all .gitignore rules from workspace
        await ignoreEngine.loadAllRules();

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Project Bundler",
            cancellable: false
        }, async (progress) => {

            progress.report({ message: t('scan'), increment: 0 });

            // --- FIX #3: Scan only selected folders, not entire common ancestor ---
            // When rootPath = '/opt' (common ancestor of 9 projects), scanning '**/*'
            // contaminates tree with unrelatconst files = await vscodeed files. Instead, scan each target folder.
            let treeFiles: vscode.Uri[] = [];

            if (targets.length > 0) {
                // Scan each selected folder individually
                const scannedPaths = new Set<string>();

                // Build exclude pattern for findFiles from excludeFolders setting
                const config = vscode.workspace.getConfiguration('projectBundler');
                const excludeFolders = config.get<string[]>('excludeFolders', []);
                const excludePattern = excludeFolders.length > 0
                    ? `{${excludeFolders.map(p => `**/${p}/**`).join(',')}}`
                    : undefined;

                const targetCount = targets.length;
                let scannedCount = 0;

                for (const target of targets) {
                    const stat = await vscode.workspace.fs.stat(target);
                    if (stat.type === vscode.FileType.Directory) {
                        const folderName = path.basename(target.fsPath);

                        // Check if this top-level folder is excluded
                        if (ignoreEngine.isFolderExcluded(folderName, target.fsPath)) {
                            scannedCount++;
                            progress.report({
                                message: `Skipping excluded: ${folderName}`,
                                increment: (100 / targetCount)
                            });
                            continue; // не сканируем
                        }

                        const pattern = new vscode.RelativePattern(target, '**/*');
                        // Pass exclude pattern - VS Code won't enter excluded folders
                        const files = await vscode.workspace.findFiles(pattern, excludePattern);
                        let ignoredCount = 0;
                        for (const f of files) {
                            if (!scannedPaths.has(f.fsPath)) {
                                scannedPaths.add(f.fsPath);
                                if (!await ignoreEngine.isIgnored(f.fsPath)) {
                                    treeFiles.push(f);
                                } else {
                                    ignoredCount++;
                                }
                            }
                        }
                        scannedCount++;
                        progress.report({
                            message: `Scanned: ${path.basename(target.fsPath)} (${files.length} files)`,
                            increment: (100 / targetCount) * 0.7
                        });
                    } else {
                        // Single file - just check if ignored
                        if (!await ignoreEngine.isIgnored(target.fsPath)) {
                            treeFiles.push(target);
                        }
                        scannedCount++;
                    }
                }
            } else {
                // No targets (e.g., Full preset) - scan from rootPath as before
                const config = vscode.workspace.getConfiguration('projectBundler');
                const excludeFolders = config.get<string[]>('excludeFolders', []);
                const excludePattern = excludeFolders.length > 0
                    ? `{${excludeFolders.map(p => `**/${p}/**`).join(',')}}`
                    : undefined;

                const rootPattern = new vscode.RelativePattern(rootPath!, '**/*');
                progress.report({ message: `Scanning: ${path.basename(rootPath!)}...`, increment: 10 });

                const allFilesRaw = await vscode.workspace.findFiles(rootPattern, excludePattern);
                progress.report({ message: `Found ${allFilesRaw.length} files, filtering...`, increment: 40 });

                // Filter with await
                for (const f of allFilesRaw) {
                    if (!await ignoreEngine.isIgnored(f.fsPath)) {
                        treeFiles.push(f);
                    }
                }
                progress.report({ message: `Filtered: ${treeFiles.length} files`, increment: 70 });
            }

            // Предупреждение если после фильтрации всё ещё много — значит ignoreEngine не покрывает что-то тяжёлое
            if (treeFiles.length > maxFilesWarning) {
                const answer = await vscode.window.showWarningMessage(
                    `Project Bundler: ${treeFiles.length} files found after filtering (limit: ${maxFilesWarning}). ` +
                    `Add heavy folders to customExcludes and retry.`,
                    'Cancel', 'Continue anyway'
                );
                if (answer !== 'Continue anyway') { return; }
            }

            progress.report({ message: t('scanSelected'), increment: 85 });
            
            // FIX: Pass already-scanned treeFiles to presetEngine instead of re-scanning
            const scanStart = Date.now();
            const contentFiles = await presetEngine.getFiles(options.preset, treeFiles, targets);
            progress.report({ message: `Selected ${contentFiles.length} files for content`, increment: 90 });

            // Collect excluded folder paths and binary file paths for tree rendering
            const excludedFolderPaths = await presetEngine.getExcludedFolderPaths(targets);
            const binaryFilePaths = await presetEngine.getBinaryFilePaths(treeFiles);
            progress.report({ message: "Merging file lists...", increment: 95 });

            // Merge: add content files to treeFiles if not already present
            const mergeStart = Date.now();
            const uniquePaths = new Set(treeFiles.map(u => u.fsPath));
            
            // Add excluded folder paths to treeFiles so they render in the tree
            for (const excludedPath of excludedFolderPaths) {
                const fullPath = path.join(rootPath!, excludedPath);
                if (!uniquePaths.has(fullPath)) {
                    uniquePaths.add(fullPath);
                    treeFiles.push(vscode.Uri.file(fullPath));
                }
            }
            
            // Add content files to tree
            for (const u of contentFiles) {
                if (!uniquePaths.has(u.fsPath)) {
                    uniquePaths.add(u.fsPath);
                    treeFiles.push(u);
                }
            }

            progress.report({ message: "Packing bundle...", increment: 97 });

            if (contentFiles.length > maxFilesWarning) {
                const answer = await vscode.window.showWarningMessage(
                    `Project Bundler: ${contentFiles.length} files selected for bundle content. This may produce a very large bundle.`,
                    'Cancel', 'Continue anyway'
                );
                if (answer !== 'Continue anyway') { return; }
            }

            const finalContent = await generateBundle(rootPath!, treeFiles, contentFiles, useSmartTree, excludedFolderPaths, binaryFilePaths, options.preset);
            progress.report({ message: "Bundle ready", increment: 100 });

            // F-02: Token warning thresholds
            const tokenThresholds = config.get<number[]>('tokenWarningThresholds', [32000, 64000, 128000]);
            const suppressTokenWarnings = config.get<boolean>('suppressTokenWarnings', false);
            
            if (!suppressTokenWarnings && tokenThresholds.length > 0) {
                // Extract token count from bundle header (format: "Tokens: ~Xk" or "Tokens: ~X")
                const tokenMatch = finalContent.match(/Tokens:.*?~?([\d.]+)([kM])?/);
                if (tokenMatch) {
                    let tokenCount = parseFloat(tokenMatch[1]);
                    const multiplier = tokenMatch[2];
                    if (multiplier === 'k') tokenCount *= 1000;
                    if (multiplier === 'M') tokenCount *= 1000000;
                    
                    // Check against thresholds
                    for (const threshold of tokenThresholds.sort((a, b) => a - b)) {
                        if (tokenCount >= threshold) {
                            const thresholdKey = `projectBundler.suppressedWarning.${threshold}`;
                            const isSuppressed = context.globalState.get<boolean>(thresholdKey, false);
                            
                            if (!isSuppressed) {
                                const answer = await vscode.window.showWarningMessage(
                                    `Project Bundler: Bundle size is ~${Math.round(tokenCount)} tokens, which exceeds the ${threshold} token threshold. Some LLMs may truncate or refuse this input.`,
                                    'Cancel', 'Continue anyway', "Don't show again"
                                );
                                
                                if (answer === 'Cancel') { return; }
                                if (answer === "Don't show again") {
                                    await context.globalState.update(thresholdKey, true);
                                }
                            }
                            break; // Only show highest threshold warning
                        }
                    }
                }
            }

            // F-03: Suppress editor tab if setting is enabled
            const suppressEditorTab = config.get<boolean>('suppressEditorTab', false);
            
            if (!suppressEditorTab) {
                const doc = await vscode.workspace.openTextDocument({ content: finalContent, language: 'markdown' });
                await vscode.window.showTextDocument(doc);
            }

            await vscode.env.clipboard.writeText(finalContent);
            
            if (suppressEditorTab) {
                vscode.window.showInformationMessage(`${t('done')} (copied to clipboard)`);
            } else {
                vscode.window.showInformationMessage(t('done'));
            }

            // Auto-save functionality
            if (autoSave) {
                try {
                    // Use rootPath (common ancestor of selected files) for auto-save
                    // This ensures docs/bundles is created relative to the project, not workspace
                    const bundlesDir = path.join(rootPath!, 'docs', 'bundles');
                    await fs.mkdir(bundlesDir, { recursive: true });

                    const folderName = path.basename(rootPath!);
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, ' ').slice(0, -5);
                    const fileName = `${folderName} - ${timestamp}.txt`;
                    const filePath = path.join(bundlesDir, fileName);

                    await fs.writeFile(filePath, finalContent, 'utf8');
                    vscode.window.showInformationMessage(`${t('autoSaved')}: ${filePath}`);
                } catch (err) {
                    vscode.window.showWarningMessage(`Auto-save failed: ${String(err)}`);
                }
            }
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

    // Early Access Presets
    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleMinimal', async () => {
        // EA-02: Minimal Preset - Entry points + package.json only
        runBundler([], { smartTree: true, preset: PresetType.Minimal });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleArch', async () => {
        // EA-01: Architecture Preset - Interfaces, types, configs, folder structure
        runBundler([], { smartTree: true, preset: PresetType.Architecture });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.bundleDebug', async () => {
        // EA-03: Debug Preset - Entry points + error-prone paths
        runBundler([], { smartTree: true, preset: PresetType.Debug });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.selectFolders', async (uri: vscode.Uri, allUris: vscode.Uri[]) => {
        // EA-07: Interactive Folder Selection Dialog
        const targets = allUris && allUris.length > 0 ? allUris : (uri ? [uri] : []);
        
        if (targets.length === 0) {
            // Use workspace root if no target selected
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage(t('errorRoot'));
                return;
            }
            targets.push(vscode.Uri.file(workspaceRoot));
        }
        
        const rootPath = targets[0].fsPath;
        const ignoreEngine = new IgnoreEngine(rootPath);
        await ignoreEngine.loadAllRules();
        
        // Get excluded folders from config
        const config = vscode.workspace.getConfiguration('projectBundler');
        const excludeFolders = config.get<string[]>('excludeFolders', []);
        const excludedFolderPaths = new Set(excludeFolders);
        
        // Show folder selection dialog
        const dialog = new FolderSelectorDialog(rootPath, excludedFolderPaths);
        const selectedFolders = await dialog.show();
        
        if (selectedFolders === null) {
            // User cancelled
            return;
        }
        
        if (selectedFolders.length === 0) {
            vscode.window.showWarningMessage('No folders selected. Bundle cancelled.');
            return;
        }
        
        // Convert selected folder paths to URIs
        const selectedUris = selectedFolders.map(p => vscode.Uri.file(p));
        
        // Run bundler with selected folders
        runBundler(selectedUris, { smartTree: true, preset: PresetType.Selected });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('project-bundler.enterLicense', async () => {
        await licenseManager.promptForLicense();
    }));
}