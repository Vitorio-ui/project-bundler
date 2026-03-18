// /opt/project-bundler/src/licenseManager.ts

import * as vscode from 'vscode';

export class LicenseManager {
    private context: vscode.ExtensionContext;

    private readonly KEY_EARLY_ACCESS = 'projectBundler.earlyAccessAccepted';
    private readonly KEY_DEV_PRO = 'projectBundler.devOverride';

    private readonly WARN_FILE_COUNT = 300;
    private readonly WARN_SIZE_BYTES = 500 * 1024;
    private readonly WARN_DAILY_USAGE = 50;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    // -----------------------------
    // Pro status
    // -----------------------------
    public isPro(): boolean {
        return this.context.globalState.get<boolean>(this.KEY_DEV_PRO, false);
    }

    public async toggleDevProMode() {
        const next = !this.isPro();
        await this.context.globalState.update(this.KEY_DEV_PRO, next);
        vscode.window.showInformationMessage(`Dev Pro Mode: ${next ? 'ON' : 'OFF'}`);
    }

    // -----------------------------
    // Early Access Gate
    // -----------------------------
    public async checkEarlyAccess(featureName: string): Promise<boolean> {
        if (this.isPro()) return true;

        const accepted = this.context.globalState.get<boolean>(this.KEY_EARLY_ACCESS, false);
        if (accepted) return true;

        const choice = await vscode.window.showInformationMessage(
            `✨ "${featureName}" is a Pro feature available during Early Access.`,
            { modal: true },
            "Use (Early Access)",
            "Disable feature"
        );

        if (choice === "Use (Early Access)") {
            await this.context.globalState.update(this.KEY_EARLY_ACCESS, true);
            return true;
        }

        return false;
    }

    // -----------------------------
    // Hard Pro Gate (future)
    // -----------------------------
    public async checkStrictPro(featureName: string): Promise<boolean> {
        if (this.isPro()) return true;

        const choice = await vscode.window.showInformationMessage(
            `💎 "${featureName}" requires Pro (coming in v1.0).`,
            "Notify me", "Close"
        );

        if (choice === "Notify me") {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/Vitorio-ui/project-bundler')
            );
        }
        return false;
    }

    // -----------------------------
    // Soft limits
    // -----------------------------
    public async checkLimits(files: vscode.Uri[]): Promise<boolean> {

        const dailyCount = this.getDailyCount();
        if (dailyCount > this.WARN_DAILY_USAGE && dailyCount % 10 === 0) {
            vscode.window.showWarningMessage(
                `You've generated ${dailyCount} bundles today. Thanks for using PromptPack!`
            );
        }

        if (files.length > this.WARN_FILE_COUNT) {
            const choice = await vscode.window.showWarningMessage(
                `Large selection (${files.length} files). This may be slow.`,
                "Proceed", "Cancel"
            );
            if (choice !== "Proceed") return false;
        }

        let totalSize = 0;
        for (const file of files) {
            try {
                totalSize += (await vscode.workspace.fs.stat(file)).size;
            } catch {}
        }

        if (totalSize > this.WARN_SIZE_BYTES) {
            const sizeKB = (totalSize / 1024).toFixed(0);
            const choice = await vscode.window.showWarningMessage(
                `Large bundle (~${sizeKB} KB). May exceed LLM context.`,
                "Proceed", "Cancel"
            );
            if (choice !== "Proceed") return false;
        }

        await this.incrementDailyUsage();
        return true;
    }

    // -----------------------------
    // Counters
    // -----------------------------
    private getDailyCount(): number {
        const today = new Date().toDateString();
        const lastDate = this.context.globalState.get<string>('projectBundler.lastUsageDate');

        if (lastDate !== today) return 0;
        return this.context.globalState.get<number>('projectBundler.dailyCount', 0);
    }

    private async incrementDailyUsage() {
        const today = new Date().toDateString();
        const lastDate = this.context.globalState.get<string>('projectBundler.lastUsageDate');

        let count = this.context.globalState.get<number>('projectBundler.dailyCount', 0);
        if (lastDate !== today) {
            count = 0;
            await this.context.globalState.update('projectBundler.lastUsageDate', today);
        }

        await this.context.globalState.update('projectBundler.dailyCount', count + 1);
    }

    // -----------------------------
    // UX
    // -----------------------------
    public async promptForLicense() {
        vscode.window.showInformationMessage(
            this.isPro()
                ? "💎 Pro License Active (Dev Mode)"
                : "💎 Pro version is in development. You're using Free / Early Access."
        );
    }

    public async resetState() {
        await this.context.globalState.update(this.KEY_EARLY_ACCESS, undefined);
        await this.context.globalState.update('projectBundler.dailyCount', 0);
        await this.context.globalState.update('projectBundler.lastUsageDate', undefined);
        vscode.window.showInformationMessage("PromptPack state reset.");
    }
}