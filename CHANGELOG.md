# Changelog

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