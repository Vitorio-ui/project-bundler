# Changelog

## 🎁 Early Access (Until v1.0)

**All features are currently free until v1.0.**

Early users will keep access to Pro features as a thank you for feedback and support.

### Early Access Features

- ✅ Smart Tree Compression
- ✅ Context Presets (Minimal, Architecture, Debug)
- ✅ Interactive Folder Selection
- ✅ Context-aware File Ordering
- ✅ JSON Transformer
- ✅ Database Schema Extractor

> **Note:** After v1.0, some Early Access features may move to the Pro tier. Early users retain access.

---

## [0.2.7] - 2026-03-18

### Added
- **New 3-Layer Preset Architecture:** Complete refactor from monolithic to modular design:
  - **Layer 1: FileAnalyzer** (`presetAnalyzer.ts`) - Collects semantic metadata from files
    - `FileMeta` type with semantic flags, structural info, and dynamics (including `sizeBytes`)
    - Heuristics for entry points, configs, tests, interfaces, root docs
  - **Layer 2: FileScorer** (`presetScorer.ts`) - Calculates importance scores with sharp weights
    - Semantic scoring (entry +1000, config +500, interface +200)
    - Structural scoring (depth-based, core folders)
    - Dynamic scoring (recency bias: today +300, this week +100)
    - Heavy penalties (tests -500, binaries -1000, large files -100 per 10KB over 20KB)
  - **Layer 3: PresetSelector** (`presetSelector.ts`) - Applies preset-specific filtering with hard constraints
    - Minimal: Entry + config + root docs, max 10 files
    - Architecture: Depth ≤3 + semantic flags, excludes files >15KB, max 40 files
    - Debug: Prioritized filtering (recent > error-prone > entry), max 25 files
  - **PresetEngine** - Now an orchestrator that coordinates the 3 layers

### Changed
- **🟢 Minimal Preset ("How to run the project?"):**
  - Before: Top 20 scoring files (often 50% of project)
  - After: Hard constraints - only entry points, configs, root documentation
  - Limit: Maximum 10 files (was 20)
  - Benefits: Truly minimal (~5-15 files), focused on "how to run"

- **🔵 Architecture Preset ("How is the project structured?"):**
  - Before: Depth ≤3 + semantic flags, no size limit
  - After: Added hard file size limit (>15KB excluded)
  - Depth constraint tightened: ≤3 for root files, ≤5 for core folders only
  - Limit: Maximum 40 files
  - Benefits: Prevents token bloat from large files

- **🔴 Debug Preset ("Where might the problem be?"):**
  - Before: Flat filter (entry OR error-prone OR recent)
  - After: Prioritized filtering - recent files first, then error-prone, then entry points
  - Limit: Maximum 25 files
  - Benefits: Focuses on most likely bug sources

- **Token Stats - Top Heavy Files:**
  - New section in bundle header showing largest files by token count
  - Displays: path, token estimate, size in KB
  - Example:
    ```
    Top heavy files:
      • src/jsonTransformer.ts (~24k tokens, 17.4 KB)
      • src/bundler.ts (~15k tokens, 12.1 KB)
    ```
  - Benefits: Transparency - users understand why N files = X tokens

- **📝 Unified Markdown Format (v0.2.7):**
  - Complete overhaul of bundle output format for better LLM and human readability
  - **Emoji Preset Markers:** 🟢 Minimal, 🟡 Architecture, 🔴 Debug, 🔵 Full, ✨ Selected
  - **Top Heavy Files Table:** Markdown table showing largest files by tokens
  - **Structured Project Tree:** Hierarchical view with token counts per file/folder
  - **Syntax-Highlighted Code Blocks:** Language-specific formatting for 20+ languages (TypeScript, Python, Rust, Go, etc.)
  - **Visual Markers:** `⚠️ [excluded]` for excluded files, `📦 [binary]` for binary files
  - **Context Modules Foundation:** Extensible sections for Database Schema, Infra, API context
  - **Mermaid Diagrams:** Architecture preset includes dependency graph visualization
  - **LLM-Optimized:** Structured headers create semantic blocks for better AI understanding
  - **Future-Ready:** Format designed for easy extension with new context modules
  - **Auto-save with .md extension:** New format saves bundles as `.md` files for better Markdown editor support
  - Controlled via `projectBundler.useMarkdownFormat` setting (Default: `true`)

### Technical
- **New Files:**
  - `src/bundleMarkdown.ts` (~440 lines) - Unified Markdown generator with preset emoji markers, Top Heavy Files table, syntax-highlighted code blocks, context modules foundation
  - `src/bundler.ts` - Added `generateMarkdownBundle()` function (~180 lines) for new MD format generation
- **Modified Files:**
  - `src/extension.ts` - Integrated new MD format generator with fallback to legacy format
  - `src/i18n.ts` - Added 13 new i18n keys for MD format (mdBundleTitle, mdRoot, mdPreset, etc.) in all 7 languages
  - `package.json` - Added `projectBundler.useMarkdownFormat` setting
  - `package.nls*.json` - Added i18n translations for new setting
- **Localization:**
  - Full i18n support for MD format in English, Russian, Spanish, German, French, Japanese, Chinese
- All 132 tests passing
- Bug fixes:
  - Fixed preset scoring "smearing" - now uses sharp weights (1000/500/200 vs 100/80/60)
  - Fixed Minimal preset including too many files (was 20, now max 10)
  - Fixed Architecture preset token bloat (now excludes files >15KB)
  - Fixed Debug preset lacking prioritization (recent files now first)

## [0.2.6] - 2026-03-17

### Added
- **JSON Transformer:** Automatic transformation of JSON files to AI-friendly YAML-like format:
  - `package.json` → metadata, scripts, dependencies (85% token savings)
  - `package-lock.json` → dependency tree structure only (90% token savings)
  - `tsconfig.json` → compiler options, paths, includes/excludes (60% token savings)
  - `.vscode/*.json` → grouped settings (settings.json, launch.json, tasks.json, extensions.json)
  - **Python:** `requirements.txt`, `Pipfile`, `pyproject.toml` (40-60% savings)
  - **Rust:** `Cargo.toml`, `Cargo.lock` (50-70% savings)
  - **Go:** `go.mod`, `go.sum` (60-80% savings)
  - **PHP:** `composer.json`, `composer.lock` (50-70% savings)
  - **Ruby:** `Gemfile`, `Gemfile.lock` (50-70% savings)
  - Generic JSON/YAML/TOML/XML → YAML-like conversion for other files
- **Database Schema Extractor:** Extract database schema from multiple sources:
  - SQLite files (`.db`, `.sqlite`, `.sqlite3`) → table structure with columns, indexes, foreign keys
  - SQL migration files → parsed CREATE TABLE/INDEX/ALTER TABLE statements
  - **Prisma:** `schema.prisma` → models, fields, relations
  - Mermaid ER diagram output for visual AI context
  - Relationship detection from foreign keys
- **`.bundlerignore` Support (F-01):** Project-level ignore file separate from `.gitignore`:
  - Works like `.gitignore` but only for PromptPack
  - Supports all gitignore patterns (prefix, suffix, wildcards, negation)
  - Nested `.bundlerignore` files in subdirectories
  - Enabled by default via `projectBundler.useBundlerignore` setting
- **includeDocsFromGitignore Setting:** Include `docs/` folder in bundle even if listed in `.gitignore`:
  - Useful for AI documentation bundles
  - Skips `docs/` patterns from `.gitignore` when enabled
  - Disabled by default (opt-in)
- **Early Access Presets:**
  - **Architecture Preset (EA-01):** Interfaces, types, configs, folder structure only
  - **Minimal Preset (EA-02):** Entry points + package.json only (90-95% token savings)
  - **Debug Preset (EA-03):** Entry points + error-prone paths (logger, errors, middleware)
- **Interactive Folder Selection (EA-07):** Dialog for selecting folders to include:
  - Right-click → "Select Folders to Include..."
  - Checklist with Select All / Deselect All / Reset
  - Visual tree with nested folders
- **Context-aware File Ordering (EA-04):** Sort files by dependency graph:
  - Entry points first (index, main, app)
  - Then dependencies in topological order
  - Supports 10 languages (TS, JS, Python, Rust, Go, PHP, Ruby, Java, C#, Rust)
  - Mermaid dependency diagram in bundle
  - Enabled via `projectBundler.useDependencyOrdering` setting
- **Token Count per File/Folder (F-04):** Display token counts in tree:
  - Per-file: `filename.ts (~1.2k)`
  - Per-folder: `src/ (~15.2k)`
  - Aggregated from all nested files
- **Token Warning Thresholds (F-02):** Soft warnings for large bundles:
  - Default thresholds: 32k, 64k, 128k tokens
  - Configurable via `projectBundler.tokenWarningThresholds`
  - "Don't show again" option per threshold
- **Suppress Editor Tab (F-03):** Clipboard-only workflow:
  - Enable via `projectBundler.suppressEditorTab`
  - Bundle copied to clipboard without opening editor
  - Toast notification on completion
- **Performance Optimizations:**
  - `getExcludedFolderPaths()` uses `findFiles` instead of recursive scan (10-60x faster)
  - Progress reporting for scanning phase with percentages
  - Reduced duplicate filtering in `extension.ts`
- **Documentation:** New `docs/EXCLUSIONS_BY_LANGUAGE.md` with comprehensive language-specific exclusion guide

### Changed
- **Updated README.md:** Added JSON Transformer, Database Extractor, Presets, and new settings documentation
- **Expanded excludeFolders defaults:** Added `bower_components`, `jspm_packages`, `.mvn`, `.cargo`, `packages`, `Pods`, `.pub` for broader language support
- **Free Tier Features:** JSON Transformer, Database Extractor, File Ordering, Folder Selection are free (moved from Pro tier)
- **BACKLOG.md:** Database Schema moved to Early Access (EA-06) for future monetization

### Fixed
- **docs/bundles exclusion:** Re-added to `excludeFolders` defaults (prevents bundle zipping)
- **Prisma parsing:** Handle optional fields and relations correctly

### Technical Changes
- **New Files:** 
  - `src/jsonTransformer.ts` (~900 lines, language-specific transformers)
  - `src/dbExtractor.ts` (~350 lines, SQLite + migrations + Prisma)
  - `src/dependencyGraph.ts` (~280 lines, import parsing + topological sort)
  - `src/folderSelector.ts` (~280 lines, interactive dialog)
  - `src/parsers/index.ts` (~80 lines, YAML/TOML/XML parsers)
  - `docs/EXCLUSIONS_BY_LANGUAGE.md` (language-specific exclusion guide)
- **Modified Files:** `package.json`, `package.nls*.json`, `src/ignoreEngine.ts`, `src/bundler.ts`, `src/extension.ts`, `src/presetEngine.ts`, `README.md`, `BACKLOG.md`, `CHANGELOG.md`
- **Dependencies:** Added `yaml`, `toml`, `fast-xml-parser` (3 packages, ~50KB total)

### Settings Added
- `projectBundler.transformJsonFiles` (Default: `true`) — Enable/disable JSON transformation
- `projectBundler.extractDatabaseSchema` (Default: `true`) — Enable/disable database schema extraction
- `projectBundler.useBundlerignore` (Default: `true`) — Enable/disable `.bundlerignore` file support
- `projectBundler.includeDocsFromGitignore` (Default: `false`) — Include `docs/` even if in `.gitignore`
- `projectBundler.useDependencyOrdering` (Default: `false`) — Sort files by dependency order
- `projectBundler.tokenWarningThresholds` (Default: `[32000, 64000, 128000]`) — Token warning thresholds
- `projectBundler.suppressEditorTab` (Default: `false`) — Clipboard-only workflow

### Token Savings Examples
| File | Before | After | Savings |
|------|--------|-------|---------|
| `package-lock.json` | ~29k tokens | ~3k tokens | 90% |
| `package.json` | ~1.8k tokens | ~200 tokens | 89% |
| `tsconfig.json` | ~122 tokens | ~50 tokens | 59% |
| `Cargo.lock` (Rust) | ~15k tokens | ~5k tokens | 67% |
| `go.sum` (Go) | ~50k tokens | ~10k tokens | 80% |
| `composer.lock` (PHP) | ~20k tokens | ~7k tokens | 65% |
| SQLite (10 tables) | 0 (binary) | ~500 tokens | +new info |
| Prisma schema (20 models) | ~2k tokens | ~1k tokens | 50% |

### Bundle Size by Preset (v0.2.7)
| Preset | Files | Tokens | Reduction | Intent |
|--------|-------|--------|-----------|--------|
| **Full** | 100% | ~100k | — | Complete project |
| **Architecture** | ~15-25% | ~40-50k | 50-60% | How is it structured? |
| **Minimal** | ~5-10% | ~8-10k | 90-95% | How to run? |
| **Debug** | ~15-25% | ~50-60k | 40-50% | Where's the bug? |
| **Selected** | ~50% | ~70k | 30% | User's choice + transparency |

> **v0.2.7 improvements:** 
> - Minimal reduced from 20 → 10 files, Architecture now excludes files >15KB, Debug prioritizes recent files, Selected shows "Top heavy files" for transparency
> - **New Unified Markdown Format:** All presets now output clean, LLM-optimized Markdown with emoji markers, Top Heavy Files tables, syntax-highlighted code blocks, and context modules

## [0.2.5] - 2026-03-09

### Added
- **Three-Tier Exclusion System:** Complete refactor of the ignore engine with three independent exclusion categories:
  - `projectBundler.excludeFolders`: Folder patterns excluded from scanning (never entered during file discovery)
  - `projectBundler.binaryExtensions`: File extensions treated as binary (shown in tree, content never read) — expanded from existing setting
  - `projectBundler.userExcludes`: Additional glob patterns applied on top of folder and binary excludes
- **Fast Folder Exclusion:** New `isFolderExcluded()` method in `IgnoreEngine` performs pattern matching before directory traversal, preventing unnecessary file system scans of excluded folders.
- **VS Code findFiles Integration:** Exclude patterns now passed directly to `vscode.workspace.findFiles()` as second parameter, preventing VS Code from entering excluded folders at the filesystem level (not just post-filtering).
- **Tree Visualization:** Excluded folders now display as `[excluded]` in the tree without recursing into contents. Binary files display as `[binary]`.
- **Unit Tests:** Added 3 new tests for excluded folders and binary file rendering in `TreeGenerator`.

### Changed
- **IgnoreEngine Refactor:** Removed hardcoded `alwaysExclude` array. All exclusion rules now load from VS Code settings.
- **Backward Compatibility:** `projectBundler.customExcludes` is deprecated but still functional (merged with `userExcludes`). `projectBundler.binaryExtensions` is now the primary setting (no longer deprecated).
- **TreeGenerator Interface:** Added optional `excludedFolderPaths` and `binaryFilePaths` to `TreeOptions` with default empty Sets — existing tests continue to work without modification.
- **PresetEngine:** Updated `expandFolders()` to check folder exclusion before calling `findFiles()` AND pass exclude glob to `findFiles()` for true pre-scan exclusion.
- **Async Fix:** `isFileExcluded()` and `isIgnored()` are now properly `async` with `await loadAllRules()` — fixes race condition where rules might not be loaded.

### Fixed
- **Gitignore Bug #1:** Patterns without slashes (e.g., `*.py`, `__pycache__`) in nested `.gitignore` files now correctly scope to their directory.
- **Gitignore Bug #2:** Patterns with leading slashes (e.g., `/dist`) now correctly remove the slash and scope to the `.gitignore` directory.
- **Performance:** Reduced file system I/O by checking folder exclusion before directory traversal AND by passing exclude patterns to `findFiles()`.
- **`docs/bundles` in excludeFolders:** Removed — was ineffective since `isFolderExcluded` checks basename only, not full paths.
- **`excludeBinaries` duplicate setting:** Removed — functionality merged into existing `binaryExtensions` setting.
- **Race condition in `isIgnored()`:** Now properly awaits `loadAllRules()` before checking rules.
- **Auto-save permission denied error:** Fixed `EACCES: permission denied, mkdir '/docs'` when VS Code is opened without a workspace. Auto-save now uses `rootPath` (common ancestor of selected files) instead of `workspaceFolders[0]`, ensuring `docs/bundles/` is created in the project directory.

### Technical Changes
- **Dependencies:** No new dependencies. Custom simple glob matching implemented without external libraries.
- **Files Changed:** `package.json`, `package.nls*.json`, `src/ignoreEngine.ts`, `src/treeGenerator.ts`, `src/presetEngine.ts`, `src/extension.ts`, `src/bundler.ts`

## [0.2.4] - 2026-03-06

### Added
- **Separate Date/Time Format Settings:** Split date and time formatting into independent settings:
  - `projectBundler.dateFormat`: Custom date format using tokens `DD`, `MM`, `YYYY` (Default: `DD.MM.YYYY`)
  - `projectBundler.timeFormat`: Custom time format using tokens `HH`/`hh`, `mm`, `ss` (Default: `HH:mm:ss`)
  - `projectBundler.timeFormat12h`: Toggle between 12-hour (with AM/PM) and 24-hour format (Default: `false` for 24-hour)
  - Users can now configure date only, time only, both, and choose 12h or 24h format
- **Nested .gitignore Support:** Complete refactor of IgnoreEngine to properly merge all `.gitignore` files from the entire workspace into a single comprehensive filter.
- **Unit Tests:** 21 comprehensive tests for `TreeGenerator` covering basic rendering, Smart compression, batch threshold, context siblings (±2), Windows paths, and edge cases.
- **Pre-publish Validation:** New `npm run validate` script runs compile, lint, tests, version check, and README↔settings sync verification.
- **Code Coverage:** NYC integration with 97.77% line coverage on core logic.

### Changed
- **i18n:** All new features fully translated to English, Russian, Spanish, German, French, Japanese, and Chinese.
- **tsconfig.json:** Added `include`/`exclude` to prevent test files from interfering with main compilation.

### Fixed
- **.gitignore Support (v2):** Complete refactor of IgnoreEngine to properly merge all `.gitignore` files from the entire workspace. Previously, nested `.gitignore` rules were checked individually, which could miss some patterns. Now all rules are collected, normalized to workspace-root-relative paths, and merged into a single comprehensive filter that is applied uniformly to all files.
  - Patterns with `/` (e.g., `build/`) are prefixed with their directory path
  - Patterns without `/` (e.g., `*.log`, `__pycache__`) match at all levels (git behavior)
  - Root `.gitignore` + all nested `.gitignore` files are scanned and merged
- **Test Coverage Gaps:** Identified dead code in batch folder names display (lines 212-215 of `treeGenerator.ts`). The `folderNames` array is never populated because cold folders render directly in `renderChildren`. Tracked as TD-06.
- **Windows Path Handling:** Tests adapted to handle backslash paths on Windows; noted as potential future normalization issue.

### Known Issues
- **TD-06:** Batch folder names display logic is unreachable. Requires refactoring of batch system to properly show collapsed folder names with "+N more" notation.

## [0.2.3] - 2026-03-06

### Added
- **File Modification Dates:** Each file in the bundle now includes its last modified timestamp. Helps AI understand file recency and change history.
- **Auto-Save Bundles:** New `projectBundler.autoSave` setting automatically saves bundles to `docs/bundles/` folder with timestamped filenames (`<project_name> - <YYYY-MM-DD HH-MM-SS>.txt`).
- **Token Control:** New `projectBundler.includeFileDate` setting to disable file dates for token optimization.

## [0.2.2] - 2026-02-18

### Fixed
- **Root Auto-Detection:** The extension now automatically computes the
  correct project root as the common ancestor of all selected files and
  folders. Previously, when VS Code was opened at a high-level directory
  (e.g. `/`), the tree would incorrectly include unrelated system folders
  like `usr/` alongside the actual project.
- **[excluded] Labels:** Fixed a path separator bug that caused some
  selected files to be incorrectly labeled `[excluded]` in the tree.
- **Missing Files in Tree:** Removed a hard file count limit that was
  silently cutting off `allFilePaths` in large repositories, causing
  files in selected folders to disappear from the tree entirely.
- **Double Folder Lines:** Fixed a rendering bug where cold (collapsed)
  folders appeared twice — once as a name and once as a summary line.

### Changed
- **Smart Tree — Context Siblings (±2):** Files adjacent to your
  selection are now shown in the tree, giving clearer structural context.
- **Smart Tree — Batch Position:** Collapsed groups of hidden items now
  appear at their correct alphabetical position within the folder, not
  forced to the bottom of the list.
- **Smart Tree — Batch Readability:** Groups smaller than 4 hidden items
  are shown individually with `[excluded]` instead of being collapsed.
  Larger groups now include up to 3 folder names in the summary line.
- **Bundle Header:** Root path is now shown explicitly in the header
  (`Root: /opt/ocr-service/train_dispatcher`).

## [0.2.1] - 2026-02-18
### Fixed
- **Smart Tree Logic:** Completely overhauled the tree compression algorithm to fix overly aggressive and noisy output. The new context-aware logic now correctly:
  - Displays a context "radius" of ±2 files around selected items.
  - Collapses fully irrelevant folders into a single summary line (e.g., `folder/ (2 folders, 5 files hidden)`).
  - Groups multiple hidden items inside a relevant folder into a clean final summary.
  - This results in a much more readable and useful tree structure for LLM context.

## [0.2.0] - 2026-02-18

### Added
- **Visual UX:** The context menu is now located at the very top of the list (`navigation` group) for instant access.
- **Smart Tree Compression (Early Access):** New mode that intelligently collapses irrelevant folders in the project tree, focusing the context on your selection and saving tokens.
- **Token Stats:** Every bundle now includes an estimated total token count and size in KB.
- **Localization:** Bundle headers and statistics now fully support English, Russian, Spanish, German, French, Japanese, and Chinese.

### Fixed
- **Menu Visibility:** Fixed an issue where some menu items were missing in the submenu.
- **Localization Bug:** Fixed a bug where the generated bundle output remained in English regardless of the language setting.
- **Bundler Logic:** Corrected the internal pipeline to ensure accurate token counts and proper assembly of the final bundle.

### Changed
- **Docs:** Fully updated README to reflect all current features and settings.

## [0.1.3] - 2026-02-13
### Added
- **Docs:** sync README with actual settings

## [0.1.2] - 2026-02-13
### Added
- **UI Localization:** Menus and settings are now translated into Russian, Spanish, German, French, Japanese, and Chinese.
- **Smart Tree:** Selected files inside ignored folders (e.g., `node_modules` or `.gitignore`) now correctly appear in the tree structure with their path.
- **Settings:** Added `Custom Excludes` to filter specific files/folders globally.
- **Settings:** Added `Language` option to manually override the bundle output language.


## [0.1.1] - 2026-02-13
### Added
- Initial release
- Project structure bundling
- Selected files bundling
- .gitignore support
- Clipboard copy