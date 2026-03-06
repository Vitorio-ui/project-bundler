import * as vscode from 'vscode';

type Dict = { [key: string]: string };
type Translations = { [lang: string]: Dict };

const translations: Translations = {
    'en': {
        generated: 'Generated',
        mode: 'Mode',
        modeSmart: 'Selected files + Smart Tree',
        modeFull: 'Full Project',
        modeSelected: 'Selected files (Standard)',
        stats: 'STATS',
        filesCount: 'Files',
        kb: 'Size',
        tokens: 'Tokens',
        structure: 'PROJECT STRUCTURE',
        treeLegend: 'files marked [excluded] are not in the bundle',
        contents: 'FILE CONTENTS',
        excluded: 'excluded',
        scan: 'Scanning project...',
        scanSelected: 'Analyzing selection...',
        done: 'Bundle created and copied to clipboard!',
        errorRoot: 'Please open a project folder first!',
        lastModified: 'Last modified',
        autoSaved: 'Bundle auto-saved to',

        // Menu
        menuPlaceholder: 'How do you want to build the context?',
        menuSelected: 'Bundle Selected Files',
        menuSelectedDesc: 'Selected files content + Smart compressed tree',
        menuFull: 'Bundle Entire Project',
        menuFullDesc: 'All non-ignored files + Full tree',
        menuArchPreset: 'Architecture Preset',
        commandSmartMenu: 'Context Builder...'
    },
    'ru': {
        generated: 'Сгенерировано',
        mode: 'Режим',
        modeSmart: 'Выбранное + Smart Tree',
        modeFull: 'Весь проект',
        modeSelected: 'Только выбранное',
        stats: 'СТАТИСТИКА',
        filesCount: 'Файлы',
        kb: 'Размер',
        tokens: 'Токены',
        structure: 'СТРУКТУРА ПРОЕКТА',
        treeLegend: 'файлы с меткой [excluded] не включены в бандл',
        contents: 'СОДЕРЖИМОЕ ФАЙЛОВ',
        excluded: 'исключен',
        scan: 'Сканирование проекта...',
        scanSelected: 'Анализ выбранного...',
        done: 'Бандл создан и скопирован в буфер!',
        errorRoot: 'Сначала открой папку с проектом!',
        lastModified: 'Последнее изменение',
        autoSaved: 'Бандл сохранён в',

        menuPlaceholder: 'Как собрать контекст?',
        menuSelected: 'Собрать выбранное',
        menuSelectedDesc: 'Контент выбранных + Умное сжатие дерева',
        menuFull: 'Собрать весь проект',
        menuFullDesc: 'Все файлы + Полное дерево',
        menuArchPreset: 'Пресет: Архитектура',
        commandSmartMenu: 'Конструктор контекста...'
    },
    'es': {
        generated: 'Generado',
        mode: 'Modo',
        modeSmart: 'Selección + Smart Tree',
        modeFull: 'Proyecto Completo',
        modeSelected: 'Archivos seleccionados',
        stats: 'ESTADÍSTICAS',
        filesCount: 'Archivos',
        kb: 'Tamaño',
        tokens: 'Tokens',
        structure: 'ESTRUCTURA DEL PROYECTO',
        treeLegend: 'archivos marcados [excluded] no están incluidos',
        contents: 'CONTENIDO DE ARCHIVOS',
        excluded: 'excluido',
        scan: 'Escaneando proyecto...',
        scanSelected: 'Analizando selección...',
        done: '¡Bundle copiado al portapapeles!',
        errorRoot: '¡Abre una carpeta de proyecto primero!',
        lastModified: 'Última modificación',
        autoSaved: 'Bundle guardado en',

        menuPlaceholder: '¿Cómo quieres construir el contexto?',
        menuSelected: 'Empaquetar Selección',
        menuSelectedDesc: 'Contenido seleccionado + Árbol inteligente',
        menuFull: 'Proyecto Completo',
        menuFullDesc: 'Todos los archivos + Árbol completo',
        menuArchPreset: 'Preset: Arquitectura',
        commandSmartMenu: 'Constructor de Contexto...'
    },
    'de': {
        generated: 'Erstellt',
        mode: 'Modus',
        modeSmart: 'Auswahl + Smart Tree',
        modeFull: 'Vollständiges Projekt',
        modeSelected: 'Ausgewählte Dateien',
        stats: 'STATISTIK',
        filesCount: 'Dateien',
        kb: 'Größe',
        tokens: 'Token',
        structure: 'PROJEKTSTRUKTUR',
        treeLegend: 'Dateien mit [excluded] sind nicht enthalten',
        contents: 'DATEINHALTE',
        excluded: 'ausgeschlossen',
        scan: 'Projekt wird gescannt...',
        scanSelected: 'Auswahl wird analysiert...',
        done: 'Bundle erstellt und in die Zwischenablage kopiert!',
        errorRoot: 'Bitte öffnen Sie zuerst einen Projektordner!',
        lastModified: 'Zuletzt geändert',
        autoSaved: 'Bundle gespeichert unter',

        menuPlaceholder: 'Wie soll der Kontext erstellt werden?',
        menuSelected: 'Auswahl bündeln',
        menuSelectedDesc: 'Inhalt der Auswahl + Smart Tree',
        menuFull: 'Gesamtes Projekt',
        menuFullDesc: 'Alle Dateien + Vollständiger Baum',
        menuArchPreset: 'Preset: Architektur',
        commandSmartMenu: 'Kontext-Builder...'
    },
    'fr': {
        generated: 'Généré',
        mode: 'Mode',
        modeSmart: 'Sélection + Smart Tree',
        modeFull: 'Projet Complet',
        modeSelected: 'Fichiers sélectionnés',
        stats: 'STATISTIQUES',
        filesCount: 'Fichiers',
        kb: 'Taille',
        tokens: 'Tokens',
        structure: 'STRUCTURE DU PROJET',
        treeLegend: 'les fichiers marqués [excluded] ne sont pas inclus',
        contents: 'CONTENU DES FICHIERS',
        excluded: 'exclu',
        scan: 'Scan du projet...',
        scanSelected: 'Analyse de la sélection...',
        done: 'Bundle copié dans le presse-papiers !',
        errorRoot: 'Veuillez d\'abord ouvrir un dossier projet !',
        lastModified: 'Dernière modification',
        autoSaved: 'Bundle enregistré sous',

        menuPlaceholder: 'Comment construire le contexte ?',
        menuSelected: 'Empaqueter la sélection',
        menuSelectedDesc: 'Contenu sélectionné + Arborescence intelligente',
        menuFull: 'Projet complet',
        menuFullDesc: 'Tous les fichiers + Arborescence complète',
        menuArchPreset: 'Preset : Architecture',
        commandSmartMenu: 'Constructeur de Contexte...'
    },
    'ja': {
        generated: '生成日時',
        mode: 'モード',
        modeSmart: '選択範囲 + スマートツリー',
        modeFull: 'プロジェクト全体',
        modeSelected: '選択されたファイル',
        stats: '統計',
        filesCount: 'ファイル数',
        kb: 'サイズ',
        tokens: 'トークン',
        structure: 'プロジェクト構成',
        treeLegend: '[excluded] とマークされたファイルは含まれていません',
        contents: 'ファイルの内容',
        excluded: '除外',
        scan: 'プロジェクトをスキャン中...',
        scanSelected: '選択範囲を分析中...',
        done: 'バンドルが作成され、クリップボードにコピーされました！',
        errorRoot: '最初にプロジェクトフォルダを開いてください！',
        lastModified: '最終更新',
        autoSaved: 'バンドル保存先',

        menuPlaceholder: 'コンテキストをどう構築しますか？',
        menuSelected: '選択範囲をバンドル',
        menuSelectedDesc: '選択された内容 + スマートツリー',
        menuFull: 'プロジェクト全体',
        menuFullDesc: '全ファイル + 完全なツリー',
        menuArchPreset: 'プリセット: アーキテクチャ',
        commandSmartMenu: 'コンテキストビルダー...'
    },
    'zh-cn': {
        generated: '生成时间',
        mode: '模式',
        modeSmart: '选中项 + 智能树',
        modeFull: '完整项目',
        modeSelected: '选中文件',
        stats: '统计',
        filesCount: '文件数',
        kb: '大小',
        tokens: 'Tokens',
        structure: '项目结构',
        treeLegend: '标记为 [excluded] 的文件未包含在内',
        contents: '文件内容',
        excluded: '已排除',
        scan: '正在扫描项目...',
        scanSelected: '正在分析选中项...',
        done: 'Bundle 已创建并复制到剪贴板！',
        errorRoot: '请先打开项目文件夹！',
        lastModified: '最后修改',
        autoSaved: 'Bundle 已保存至',

        menuPlaceholder: '如何构建上下文？',
        menuSelected: '打包选中项',
        menuSelectedDesc: '选中内容 + 智能压缩树',
        menuFull: '完整项目',
        menuFullDesc: '所有文件 + 完整树结构',
        menuArchPreset: '预设：架构',
        commandSmartMenu: '上下文构建器...'
    }
};

export function t(key: string): string {
    const config = vscode.workspace.getConfiguration('projectBundler');
    let lang = config.get<string>('language', 'auto');

    if (lang === 'auto') {
        lang = vscode.env.language.toLowerCase();
    }
    
    // Normalize language codes
    if (lang.startsWith('ru')) lang = 'ru';
    else if (lang.startsWith('es')) lang = 'es';
    else if (lang.startsWith('de')) lang = 'de';
    else if (lang.startsWith('fr')) lang = 'fr';
    else if (lang.startsWith('ja')) lang = 'ja';
    else if (lang.startsWith('zh')) lang = 'zh-cn';
    else lang = 'en';

    const dict = translations[lang] || translations['en'];
    // Fallback to EN if key missing, then to key itself
    return dict[key] || translations['en'][key] || key;
}