import * as vscode from 'vscode';
import * as crypto from 'crypto';

export class LicenseManager {
    private context: vscode.ExtensionContext;
    
    // --- SOFT LIMITS FOR MVP LAUNCH ---
    private readonly FREE_MAX_FILES = 100;       // Увеличили (было 20)
    private readonly FREE_MAX_SIZE_BYTES = 500 * 1024; // 500 KB (было 200)
    private readonly FREE_DAILY_LIMIT = 10;      // 10 сборок в день (было 5)
    
    // Секрет убрали. Для MVP он пока не нужен, так как Pro выключен.
    // В будущем будем внедрять через переменные окружения при сборке.

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public isPro(): boolean {
        // ВРЕМЕННО: Pro режим выключен для всех на этапе запуска
        return false;
    }

    public async checkLimits(files: vscode.Uri[]): Promise<boolean> {
        // Проверяем дневной лимит
        const dailyCheck = await this.checkDailyUsage();
        if (!dailyCheck) return false;

        // Проверяем количество файлов
        if (files.length > this.FREE_MAX_FILES) {
            vscode.window.showErrorMessage(`Early Access Limit: Maximum ${this.FREE_MAX_FILES} files allowed per bundle. You selected ${files.length}.`);
            return false;
        }

        // Проверяем вес
        let totalSize = 0;
        for (const file of files) {
            try { totalSize += (await vscode.workspace.fs.stat(file)).size; } catch(e){}
        }
        if (totalSize > this.FREE_MAX_SIZE_BYTES) {
            vscode.window.showErrorMessage(`Early Access Limit: Maximum 500KB allowed per bundle.`);
            return false;
        }

        // Засчитываем использование
        await this.incrementDailyUsage();
        return true;
    }

    private async checkDailyUsage(): Promise<boolean> {
        const today = new Date().toDateString();
        const lastDate = this.context.globalState.get<string>('projectBundler.lastUsageDate', '');
        let count = this.context.globalState.get<number>('projectBundler.dailyCount', 0);

        if (lastDate !== today) {
            count = 0;
            await this.context.globalState.update('projectBundler.lastUsageDate', today);
            await this.context.globalState.update('projectBundler.dailyCount', 0);
        }

        if (count >= this.FREE_DAILY_LIMIT) {
            vscode.window.showErrorMessage(`Daily Limit Reached (${this.FREE_DAILY_LIMIT}/${this.FREE_DAILY_LIMIT}). Server load protection. Please come back tomorrow!`);
            return false;
        }
        return true;
    }

    private async incrementDailyUsage() {
        const count = this.context.globalState.get<number>('projectBundler.dailyCount', 0);
        await this.context.globalState.update('projectBundler.dailyCount', count + 1);
    }

    /**
     * Заглушка для ввода лицензии
     */
    public async promptForLicense() {
        await vscode.window.showInformationMessage(
            "💎 Pro Version with unlimited access is currently in development! Enjoy the Free Early Access version.",
            "OK"
        );
    }
    
    // Метод для сброса (оставляем для отладки, но команду можно скрыть)
    public async resetLicense() {
         await this.context.globalState.update('projectBundler.licenseKey', undefined);
         await this.context.globalState.update('projectBundler.dailyCount', 0);
    }
}