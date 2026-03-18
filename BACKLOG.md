# Backlog — PromptPack

> Items are grouped by tier and priority. Use GitHub Issues for assignment and status tracking.
> Legend: 🟢 Free | 🟡 Early Access | 🔵 Pro | 🔴 Tech Debt

---

## 🎁 Early Access (Until v1.0)

**All features are currently free until v1.0.**

Early users will keep access to Pro features as a thank you for feedback and support.

### Transition to v1.0

We'll launch v1.0 when:
- ✅ Clear use-case established
- ✅ Stable UX
- ✅ 20–50 real users (used ≥3 times)
- ✅ Understanding of what users will pay for

### Planned Tier Split (v1.0)

| Tier | What's Included | Philosophy |
|---|---|---|
| **🟢 Free** | Bundle, Basic Presets, Token Stats | "Solves the task" |
| **💎 Pro** | Auto file selection, Dependency Graph, DB→MD, API/Infra Context, Smart Ordering | "Makes it better" |

> **Key Principle:** Free gives results. Pro makes them better.

---

## Completed ✅

| Item | Version |
|---|---|
| Smart Bundle (selected files) | v0.1.1 |
| Token stats (tree + content) | v0.2.0 |
| Language support (NLS + manual override) | v0.2.0 |
| Smart Tree Compression (Early Access) | v0.2.0 |
| Binary detection | v0.1.1 |
| Soft warnings (size, count) | v0.2.0 |
| Context siblings ±2 in Smart Tree | v0.2.2 |
| Auto root detection from selection | v0.2.2 |
| Batch position fix (alphabetical order) | v0.2.2 |
| File Modification Dates | v0.2.3 |
| Auto-Save Bundles | v0.2.3 |
| Separate Date/Time Format Settings | v0.2.4 |
| Nested .gitignore Support | v0.2.4 |
| **Tech Debt:** Pre-publish validation script (TD-04) | v0.2.4 |
| **Tech Debt:** README ↔ settings sync check (TD-05) | v0.2.4 |
| **Tech Debt:** Unit tests for TreeGenerator (TD-02) | v0.2.4 |
| **Tech Debt:** Code coverage infrastructure (NYC) | v0.2.4 |
| **Documentation:** Testing & Validation section in README | v0.2.4 |
| **Documentation:** CHANGELOG updated with bug findings | v0.2.4 |
| **Tech Debt:** Fix dead code: batch folder names display (TD-06) | v0.2.5 |
| **Feature:** Three-Tier Exclusion System (excludeFolders, userExcludes, binaryExtensions) | v0.2.5 |
| **Feature:** Fast Folder Exclusion (isFolderExcluded before scanning) | v0.2.5 |
| **Feature:** Tree visualization for excluded folders and binary files | v0.2.5 |
| **Bug Fix:** Gitignore pattern scoping bugs #1 and #2 | v0.2.5 |
| **Bug Fix:** Pass exclude patterns to findFiles() for true pre-scan exclusion | v0.2.5 |
| **Bug Fix:** Race condition in isIgnored() - now properly awaits loadAllRules() | v0.2.5 |
| **Bug Fix:** Remove docs/bundles from excludeFolders (basename vs path issue) | v0.2.5 |
| **Bug Fix:** Remove duplicate excludeBinaries setting (merged into binaryExtensions) | v0.2.5 |
| **Bug Fix:** Auto-save permission denied when no workspace (EACCES: mkdir '/docs') | v0.2.5 |
| **Performance:** Optimize getExcludedFolderPaths() to use findFiles instead of recursive scan | v0.2.6 |
| **Performance:** Add progress reporting for scanning phase | v0.2.6 |
| **Feature:** `.bundlerignore` file support (F-01) | v0.2.6 |
| **Feature:** includeDocsFromGitignore setting | v0.2.6 |
| **Feature:** JSON Transformer for AI-friendly output (package.json, package-lock.json, tsconfig.json, VS Code settings, Python, Rust, Go, PHP, Ruby) | v0.2.6 |
| **Feature:** Database Schema Extractor (SQLite + SQL migrations + Prisma) with Mermaid ER diagrams | v0.2.6 |
| **Feature:** Early Access Presets (Architecture, Minimal, Debug) | v0.2.6 |
| **Feature:** Interactive Folder Selection Dialog (EA-07) | v0.2.6 |
| **Feature:** Context-aware File Ordering (EA-04) — basic implementation | v0.2.6 |
| **Feature:** Token Warning Thresholds (F-02) | v0.2.6 |
| **Feature:** Suppress Editor Tab (F-03) | v0.2.6 |
| **Feature:** Token count per file/folder in tree (F-04) | v0.2.6 |
| **Documentation:** Language-specific exclusions guide (EXCLUSIONS_BY_LANGUAGE.md) | v0.2.6 |
| **Feature:** EA-04 Complete — Dependency graph, improved import resolution, [entry] markers | v0.2.6 |
| **Feature:** Top Heavy Files Analysis — Token transparency in bundle header | v0.2.7 |
| **Feature:** Unified Markdown Format — LLM-optimized output with emoji markers, tables, syntax highlighting | v0.2.7 |
| **Tech Debt:** Unit tests for jsonTransformer.ts, dbExtractor.ts, dependencyGraph.ts, folderSelector.ts (TD-07, TD-08, TD-09, TD-10) | v0.2.6 |
| **Bug Fix:** Preset scoring "smearing" - sharp weights implementation (TD-12) | v0.2.7 |
| **Bug Fix:** Minimal preset including too many files - hard constraints (TD-13) | v0.2.7 |
| **Bug Fix:** Architecture preset token bloat - file size limit (TD-14) | v0.2.7 |
| **Bug Fix:** Debug preset lacking prioritization - recent files first (TD-15) | v0.2.7 |

---

## 🔴 Tech Debt (Do First)

These block confidence in future changes.

| ID | Item | Notes | Status |
|---|---|---|---|
| TD-01 | Snapshot tests for `bundler.ts` output | Deferred: bundler tests require complex VSCode API mocks. TreeGenerator tests cover core logic. | ⚠️ Deferred |
| TD-02 | Unit tests for `TreeGenerator` | 24 tests covering: basic rendering, Smart compression, batch threshold, Windows paths, context siblings, excluded folders, binary files | ✅ Done v0.2.5 |
| TD-03 | Integration test for `runBundler` pipeline | Use `@vscode/test-electron`; at minimum test Full and Selected presets | ⚠️ Deferred (requires VS Code test harness) |
| TD-04 | Pre-publish validation script | Script at `scripts/validate.sh`, runs compile + lint + tests + version check | ✅ Done v0.2.3 |
| TD-05 | README ↔ settings sync checklist | Automated as `scripts/check-settings-sync.js`, runs in validate step | ✅ Done v0.2.3 |
| TD-06 | Fix dead code: batch folder names display (lines 212-215) | `folderNames` never populated — cold folders render directly in `renderChildren`. Requires refactoring batch logic. | ✅ Done v0.2.5 |
| TD-07 | Unit tests for `jsonTransformer.ts` | 30+ tests covering: package.json, package-lock.json, tsconfig.json, VS Code settings, Python, Rust, Go, PHP, Ruby transformers | ✅ Done v0.2.6 |
| TD-08 | Unit tests for `dbExtractor.ts` | 15+ tests covering: SQLite detection, migration file detection, Prisma schema parsing, result structures | ✅ Done v0.2.6 |
| TD-09 | Unit tests for `dependencyGraph.ts` | 35+ tests covering: graph construction, depth calculation, import parsing for 10+ languages, entry point detection | ✅ Done v0.2.6 |
| TD-10 | Unit tests for `folderSelector.ts` | 25+ tests covering: exclusion logic, selection management, path handling, parent-child selection | ✅ Done v0.2.6 |
| TD-11 | Token estimation calibration for Gemini/Claude tokenizers | Current char-based estimation undercounts by ~45%. Need calibration factor or LLM-specific tokenizers. Target: v0.3.0 | 📋 Backlog |

---

## 🟢 Free Tier — Active

| ID | Item | Priority | Notes |
|---|---|---|---|
| F-01 | `BUNDLER.ignore` file support | ✅ Done v0.2.6 | Implemented as `.bundlerignore` |
| F-02 | Token-aware soft warning thresholds | ✅ Done v0.2.6 | Warn at 32k / 64k / 128k tokens |
| F-03 | Setting to suppress editor tab on bundle | ✅ Done v0.2.6 | Clipboard-only workflow option |
| F-04 | Token count per file/folder in tree | ✅ Done v0.2.6 | Display only (Pro: auto-exclude over budget) |

---

## 🟡 Early Access → Stage 2

| ID | Item | Priority | Notes |
|---|---|---|---|
| EA-01 | Preset: Architecture | ✅ Done v0.2.6 | Interfaces, types, configs, folder structure |
| EA-02 | Preset: Minimal | ✅ Done v0.2.6 | Entry points + package.json only |
| EA-03 | Preset: Debug | ✅ Done v0.2.6 | Entry points + error-prone paths |
| EA-04 | Context-aware file ordering | ✅ Done v0.2.6 | Entry points first, dependencies second. Features: dependency graph, import parsing for 10+ languages, visual [entry] markers in tree, enabled by default |
| EA-05 | Custom Presets (save/load per workspace) | P2 | User-defined filter configurations |
| EA-06 | Database Schema Context | ✅ Done v0.2.6 | SQLite + migrations + Prisma parser |
| EA-07 | Interactive Folder Selection Dialog | ✅ Done v0.2.6 | Right-click → checklist with [Done] button |

---

## 🔵 Pro v1.0

| ID | Item | Priority | Notes |
|---|---|---|---|
| P-01 | Pro license key (offline validation) | P0 | Required to ship Pro |
| P-02 | Context Profiles (per workspace config) | P0 | Saved preset + exclude combos |
| P-03 | Diff Mode | P0 | Bundle only files changed since last git commit |
| P-04 | Token Budget Targeting — depends on F-04 (token counts in tree) | P1 | "Fit in 8k / 32k / 128k" — auto-trim strategy |
| P-05 | ~~Database Schema Context~~ | ✅ Moved to EA-06 | Moved to Early Access for monetization in v1.0 |
| P-06 | API Context | P1 | Extract REST/GraphQL route definitions |
| P-07 | Auto-summary for collapsed folders | P1 | One-line AI-generated description of hidden content |
| P-08 | Smart file ordering engine | ✅ Done v0.2.6 (EA-04) | Implemented as dependency-based ordering |
| P-09 | Infra Context | P2 | Parse Dockerfile, docker-compose, k8s manifests |
| P-10 | Priority support channel | P2 | Dedicated GitHub label for Pro users |

---

## 🌍 Community / Ecosystem

| ID | Item | Priority | Notes |
|---|---|---|---|
| C-01 | Community preset registry | P2 | Submit/discover presets for common stacks |
| C-02 | CLI version (`npx project-bundler`) | P3 | For CI/CD and non-VS Code users |
| C-03 | GitHub Action integration | P3 | Auto-generate architecture bundle on PR |

---

## Deferred / Under Consideration

- JetBrains IDE plugin
- Telemetry opt-in (anonymous usage, explicit consent required)
- VS Code forks (Cursor, Windsurf) — community PRs welcome
