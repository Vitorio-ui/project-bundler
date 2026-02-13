import * as vscode from 'vscode';

// Типы для словаря
type Dict = { [key: string]: string };
type Translations = { [lang: string]: Dict };

const translations: Translations = {
    'en': {
        generated: 'Generated',
        mode: 'Mode',
        modeFull: 'Full Project',
        modeTree: 'Selected Files with Full Tree',
        structure: 'PROJECT STRUCTURE',
        legend: 'files marked [excluded] are not in the bundle',
        contents: 'FILE CONTENTS',
        excluded: 'excluded',
        scan: 'Scanning project...',
        scanSelected: 'Analyzing selection...',
        done: 'Bundle created and copied to clipboard!',
        errorRoot: 'Please open a project folder first!'
    },
    'ru': {
        generated: 'Сгенерировано',
        mode: 'Режим',
        modeFull: 'Полный проект',
        modeTree: 'Выбранные файлы + Дерево',
        structure: 'СТРУКТУРА ПРОЕКТА',
        legend: 'файлы с меткой [excluded] не включены в бандл',
        contents: 'СОДЕРЖИМОЕ ФАЙЛОВ',
        excluded: 'исключен',
        scan: 'Сканирование проекта...',
        scanSelected: 'Анализ выбранного...',
        done: 'Бандл создан и скопирован в буфер!',
        errorRoot: 'Сначала открой папку с проектом!'
    },
    'es': {
        generated: 'Generado',
        mode: 'Modo',
        modeFull: 'Proyecto Completo',
        modeTree: 'Archivos con Árbol Completo',
        structure: 'ESTRUCTURA DEL PROYECTO',
        legend: 'archivos marcados [excluded] no están incluidos',
        contents: 'CONTENIDO DE ARCHIVOS',
        excluded: 'excluido',
        scan: 'Escaneando proyecto...',
        scanSelected: 'Analizando selección...',
        done: '¡Bundle copiado al portapapeles!',
        errorRoot: '¡Abre una carpeta de proyecto primero!'
    },
    'de': {
        generated: 'Erstellt',
        mode: 'Modus',
        modeFull: 'Vollständiges Projekt',
        modeTree: 'Ausgewählte Dateien + Baum',
        structure: 'PROJEKTSTRUKTUR',
        legend: 'Dateien mit [excluded] sind nicht enthalten',
        contents: 'DATEINHALTE',
        excluded: 'ausgeschlossen',
        scan: 'Projekt wird gescannt...',
        scanSelected: 'Auswahl wird analysiert...',
        done: 'Bundle erstellt und in die Zwischenablage kopiert!',
        errorRoot: 'Bitte öffnen Sie zuerst einen Projektordner!'
    },
    'fr': {
        generated: 'Généré',
        mode: 'Mode',
        modeFull: 'Projet Complet',
        modeTree: 'Fichiers sélectionnés + Arborescence',
        structure: 'STRUCTURE DU PROJET',
        legend: 'les fichiers marqués [excluded] ne sont pas inclus',
        contents: 'CONTENU DES FICHIERS',
        excluded: 'exclu',
        scan: 'Scan du projet...',
        scanSelected: 'Analyse de la sélection...',
        done: 'Bundle copié dans le presse-papiers !',
        errorRoot: 'Veuillez d\'abord ouvrir un dossier projet !'
    },
    'ja': {
        generated: '生成日時',
        mode: 'モード',
        modeFull: 'プロジェクト全体',
        modeTree: '選択されたファイル + ツリー',
        structure: 'プロジェクト構成',
        legend: '[excluded] とマークされたファイルは含まれていません',
        contents: 'ファイルの内容',
        excluded: '除外',
        scan: 'プロジェクトをスキャン中...',
        scanSelected: '選択範囲を分析中...',
        done: 'バンドルが作成され、クリップボードにコピーされました！',
        errorRoot: '最初にプロジェクトフォルダを開いてください！'
    },
    'zh-cn': {
        generated: '生成时间',
        mode: '模式',
        modeFull: '完整项目',
        modeTree: '选中文件 + 完整目录树',
        structure: '项目结构',
        legend: '标记为 [excluded] 的文件未包含在内',
        contents: '文件内容',
        excluded: '已排除',
        scan: '正在扫描项目...',
        scanSelected: '正在分析选中项...',
        done: 'Bundle 已创建并复制到剪贴板！',
        errorRoot: '请先打开项目文件夹！'
    }
};

export function t(key: string): string {
    // 1. Читаем настройку пользователя
    const config = vscode.workspace.getConfiguration('projectBundler');
    const userLang = config.get<string>('language', 'auto');

    let lang = 'en';

    if (userLang !== 'auto') {
        lang = userLang;
    } else {
        // 2. Если auto, берем системный
        lang = vscode.env.language.toLowerCase();
    }
    
    // Нормализация кодов языков
    if (lang.startsWith('ru')) lang = 'ru';
    else if (lang.startsWith('es')) lang = 'es';
    else if (lang.startsWith('de')) lang = 'de';
    else if (lang.startsWith('fr')) lang = 'fr';
    else if (lang.startsWith('ja')) lang = 'ja';
    else if (lang.startsWith('zh')) lang = 'zh-cn';
    else lang = 'en'; // Дефолт

    const dict = translations[lang] || translations['en'];
    return dict[key] || key;
}