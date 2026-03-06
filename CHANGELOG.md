# Changelog

## [0.2.3] - 2026-03-06

### Added
- **File Modification Dates:** Each file in the bundle now includes its last modified timestamp (e.g., `Last modified: 2026-03-06, 14:30:15`). Helps AI understand file recency and change history.
- **Auto-Save Bundles:** New `projectBundler.autoSave` setting automatically saves bundles to `docs/bundles/` folder with timestamped filenames (`<project_name> - <YYYY-MM-DD HH-MM-SS>.txt`).
- **Token Control:** New `projectBundler.includeFileDate` setting to disable file dates for token optimization.
- **Unit Tests:** 21 comprehensive tests for `TreeGenerator` covering basic rendering, Smart compression, batch threshold, context siblings (±2), Windows paths, and edge cases.
- **Pre-publish Validation:** New `npm run validate` script runs compile, lint, tests, version check, and README↔settings sync verification.
- **Code Coverage:** NYC integration with 97.77% line coverage on core logic.

### Changed
- **i18n:** All new features fully translated to English, Russian, Spanish, German, French, Japanese, and Chinese.
- **tsconfig.json:** Added `include`/`exclude` to prevent test files from interfering with main compilation.

### Fixed
- **Test Coverage Gaps:** Identified dead code in batch folder names display (lines 212-215 of `treeGenerator.ts`). The `folderNames` array is never populated because cold folders render directly in `renderChildren`. Tracked as TD-06.
- **Windows Path Handling:** Tests adapted to handle backslash paths on Windows; noted as potential future normalization issue.

### Known Issues
- **TD-06:** Batch folder names display logic is unreachable. Requires refactoring of batch system to properly show collapsed folder names with "+N more" notation.

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