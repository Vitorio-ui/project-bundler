// update-locales.js
const fs = require('fs');
const path = require('path');

const locales = ['en', 'ru', 'es', 'de', 'fr', 'ja', 'zh-cn'];
const root = __dirname;
// CHANGED: Save directly to root for VS Code manifest compatibility
const nlsDir = root; 

const translations = {
    'en': {
        "submenu.label": "Project Bundler",
        "command.smartMenu": "Prepare Context for AI...",
        "command.bundleSelectedSmart": "Bundle Selection (Smart)",
        "command.bundleFull": "Bundle Full Project",
        "command.bundleMinimal": "Preset: Minimal (Pro)",
        "command.bundleArch": "Preset: Architecture (Pro)",
        "command.license": "Enter Pro License",
        "config.includeFullTree": "Always include the full project tree structure.",
        "config.maxFiles": "Warning limit for file count.",
        "config.language": "Extension output language.",
        "config.customExcludes": "Additional glob patterns to exclude.",
        "config.binaryExtensions": "List of file extensions to treat as binary."
    },
    'ru': {
        "command.smartMenu": "Подготовить контекст для ИИ...",
        "command.bundleSelectedSmart": "Собрать выбранное (Smart)",
        "command.bundleFull": "Собрать весь проект",
        "command.bundleMinimal": "Пресет: Минимальный (Pro)",
        "command.bundleArch": "Пресет: Архитектура (Pro)",
        "command.license": "Ввести Pro лицензию",
        "config.includeFullTree": "Всегда включать полное дерево проекта.",
        "config.maxFiles": "Лимит файлов для предупреждения.",
        "config.language": "Язык вывода.",
        "config.customExcludes": "Исключения файлов.",
        "config.binaryExtensions": "Бинарные расширения."
    },
    'es': {
        "command.smartMenu": "Preparar contexto para IA...",
        "command.bundleSelectedSmart": "Empaquetar Selección (Smart)",
        "command.bundleFull": "Proyecto Completo",
        "command.bundleMinimal": "Preset: Mínimo (Pro)",
        "command.bundleArch": "Preset: Arquitectura (Pro)",
        "command.license": "Licencia Pro"
    },
    'de': {
        "command.smartMenu": "Kontext für KI vorbereiten...",
        "command.bundleSelectedSmart": "Auswahl bündeln (Smart)",
        "command.bundleFull": "Gesamtes Projekt",
        "command.bundleMinimal": "Preset: Minimal (Pro)",
        "command.bundleArch": "Preset: Architektur (Pro)",
        "command.license": "Pro Lizenz"
    },
    'fr': {
        "command.smartMenu": "Préparer le contexte pour l'IA...",
        "command.bundleSelectedSmart": "Empaqueter la sélection",
        "command.bundleFull": "Projet Complet",
        "command.bundleMinimal": "Preset : Minimal (Pro)",
        "command.bundleArch": "Preset : Architecture (Pro)",
        "command.license": "Licence Pro"
    },
    'ja': {
        "command.smartMenu": "AI用コンテキストを準備...",
        "command.bundleSelectedSmart": "選択範囲をバンドル",
        "command.bundleFull": "プロジェクト全体",
        "command.bundleMinimal": "プリセット: ミニマル (Pro)",
        "command.bundleArch": "プリセット: アーキテクチャ (Pro)",
        "command.license": "Proライセンス"
    },
    'zh-cn': {
        "command.smartMenu": "准备 AI 上下文...",
        "command.bundleSelectedSmart": "打包选中项",
        "command.bundleFull": "完整项目",
        "command.bundleMinimal": "预设：最小化 (Pro)",
        "command.bundleArch": "预设：架构 (Pro)",
        "command.license": "Pro 许可证"
    }
};

locales.forEach(lang => {
    // VS Code expects "package.nls.json" in root for default (en)
    const filename = lang === 'en' ? 'package.nls.json' : `package.nls.${lang}.json`;
    const filePath = path.join(nlsDir, filename);
    
    let currentData = {};
    if (fs.existsSync(filePath)) {
        try {
            currentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            currentData = {};
        }
    }

    const defaultTrans = translations['en'];
    const langTrans = translations[lang] || {};
    
    // Merge logic
    const mergedData = { ...defaultTrans, ...currentData, ...langTrans };

    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 4));
    console.log(`Updated: ${path.relative(root, filePath)}`);
});

console.log("\nLocalization files updated (ROOT DIRECTORY) successfully!");