# Backlog — Project Bundler

> Items are grouped by tier and priority. Use GitHub Issues for assignment and status tracking.
> Legend: 🟢 Free | 🟡 Early Access | 🔵 Pro | 🔴 Tech Debt

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

---

## 🔴 Tech Debt (Do First)

These block confidence in future changes.

| ID | Item | Notes | Status |
|---|---|---|---|
| TD-01 | Snapshot tests for `bundler.ts` output | Deferred: bundler tests require complex VSCode API mocks. TreeGenerator tests cover core logic. | ⚠️ Deferred |
| TD-02 | Unit tests for `TreeGenerator` | 24 tests covering: basic rendering, Smart compression, batch threshold, Windows paths, context siblings, excluded folders, binary files | ✅ Done v0.2.5 |
| TD-03 | Integration test for `runBundler` pipeline | Use `@vscode/test-electron`; at minimum test Full and Selected presets | 📋 Backlog |
| TD-04 | Pre-publish validation script | Script at `scripts/validate.sh`, runs compile + lint + tests + version check | ✅ Done v0.2.3 |
| TD-05 | README ↔ settings sync checklist | Automated as `scripts/check-settings-sync.js`, runs in validate step | ✅ Done v0.2.3 |
| TD-06 | Fix dead code: batch folder names display (lines 212-215) | `folderNames` never populated — cold folders render directly in `renderChildren`. Requires refactoring batch logic. | ✅ Done v0.2.5 |

---

## 🟢 Free Tier — Active

| ID | Item | Priority | Notes |
|---|---|---|---|
| F-01 | `BUNDLER.ignore` file support | P2 | Project-level ignore rules separate from `.gitignore` |
| F-02 | Token-aware soft warning thresholds | P2 | Warn at 32k / 64k / 128k tokens |
| F-03 | Setting to suppress editor tab on bundle | P3 | Some users want clipboard-only output |
| F-04 | Token count per file/folder in tree | P1 | Show ~Xk tokens next to each node in tree and in file headers. Two-pass: collect tokens during content read, aggregate up tree. 
Free: display only. Pro (P-04): auto-exclude over budget. Target: v0.2.6 |

---

## 🟡 Early Access → Stage 2

| ID | Item | Priority | Notes |
|---|---|---|---|
| EA-01 | Preset: Architecture | P0 | Interfaces, types, configs, folder structure; see PRD US-10 |
| EA-02 | Preset: Minimal | P0 | Entry points + package.json only; see PRD US-11 |
| EA-03 | Preset: Debug | P1 | Entry points + recently modified files |
| EA-04 | Context-aware file ordering | P1 | Entry points first, dependencies second |
| EA-05 | Custom Presets (save/load per workspace) | P2 | User-defined filter configurations |

---

## 🔵 Pro v1.0

| ID | Item | Priority | Notes |
|---|---|---|---|
| P-01 | Pro license key (offline validation) | P0 | Required to ship Pro |
| P-02 | Context Profiles (per workspace config) | P0 | Saved preset + exclude combos |
| P-03 | Diff Mode | P0 | Bundle only files changed since last git commit |
| P-04 | Token Budget Targeting — depends on F-04 (token counts in tree) | P1 | "Fit in 8k / 32k / 128k" — auto-trim strategy |
| P-05 | Database Schema Context | P1 | Parse SQL migrations / ORM models |
| P-06 | API Context | P1 | Extract REST/GraphQL route definitions |
| P-07 | Auto-summary for collapsed folders | P1 | One-line AI-generated description of hidden content |
| P-08 | Smart file ordering engine | P2 | Re-order files by dependency graph |
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
