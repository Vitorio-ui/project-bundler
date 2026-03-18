# 📦 PromptPack — AI Context Builder & Bundler

<div align="center">
  <img src="icon.png" width="128" height="128" alt="PromptPack Logo">
  <p><strong>Convert your codebase to prompt. One-click workspace context for ChatGPT, Claude, DeepSeek, Gemini and local LLMs.</strong></p>
</div>

---
**PromptPack** (formerly AI Context Builder) helps you export your project structure and selected source code into a single, clean, **AI-optimized markdown prompt** — ready to paste into any LLM context window.

**Stop copying files manually. Start building better context for AI.**

> No servers. No telemetry. Fully local.

---

## 🎁 Early Access (Until v1.0)

**All features are currently free until v1.0.**

Early users will keep access to Pro features as a thank you for feedback and support.

### Planned Tier Split (v1.0)

| Tier | What's Included |
|---|---|
| **🟢 Free** | Bundle, Basic Presets, Token Stats — "solves the task" |
| **💎 Pro** | Auto file selection, Dependency Graph, DB→MD, API/Infra Context, Smart Ordering — "makes it better" |

> **Philosophy:** Free gives results. Pro makes them better.

---

## 🚀 Why PromptPack? (The Repo-to-Prompt Problem)

Working with AI on real production code is painful:
- You waste time manually copying and pasting files to chat.
- You miss crucial structural context (dependencies, configs).
- You easily blow past the **LLM token limits** with unnecessary files.
- Providing a full **repo to prompt** manually is impossible.

## ✅ Solution: Code to Prompt in One Click

Right-click → **Bundle Selection** → Paste into AI.
**PromptPack** solves codebase exporting instantly.

It automatically generates:
- A clean, readable **project tree** of your workspace.
- The full contents of selected files in a structured format.

**PromptPack solves this in one click.**

It generates:
- a readable tree of your project
- full contents of selected files
- file modification dates (optional)
- a clear separation between structure and code
- auto-saved bundles with timestamps (optional)

Perfect for:
- architecture discussions
- refactoring with AI
- debugging with full context
- onboarding AI into existing projects

---

## 🚀 Features

### 🧠 Smart Tree (Early Access)
Instead of dumping a 500-file tree structure, PromptPack intelligently collapses folders irrelevant to your selection.
*   **Focus:** Shows context only around selected files.
*   **Compression:** Collapses unrelated folders (e.g., `tests/ ... [collapsed: 42 files]`).
*   **Token Savings:** Reduces visual noise and token count significantly.
*   **Auto Root Detection:** The project root is automatically inferred from your selection — no need to open VS Code at the project folder. 
    Works correctly even when opened at `/` or a high-level system path.
*   **Context Siblings:** Shows ±2 files around each selected item so you always see what's nearby, not just the selected file in isolation.

### 📊 Token Counter & Stats (Free)
Never guess your prompt size again. Every output includes:
* Accurate **token calculator** estimates (tree + file contents).
* Total payload size in KB.
* Helps bypass **context window overflow** for OpenAI, Anthropic, Gemini and local models (like Ollama).

### 🌍 Polyglot Support
Works out-of-the-box with pre-configured ignore rules for:
*   **Web:** JS/TS, React, Vue, HTML/CSS
*   **Backend:** Node.js, Python (`__pycache__` ignored), Go (`vendor` ignored)
*   **Systems:** C++, Rust (`target` ignored), Java/Kotlin
*   **Common:** `.git`, `.vscode`, lockfiles, binary artifacts are excluded automatically.

See [docs/EXCLUSIONS_BY_LANGUAGE.md](docs/EXCLUSIONS_BY_LANGUAGE.md) for full language support details.

### 🧠 **JSON Transformer** (v0.2.6)
Automatically transforms JSON files into AI-friendly YAML-like format:
*   **package.json** → metadata, scripts, dependencies (85% token savings)
*   **package-lock.json** → dependency tree structure (90% token savings)
*   **tsconfig.json** → compiler options, paths (60% token savings)
*   **VS Code settings** → grouped settings by category
*   Disabled via `projectBundler.transformJsonFiles` setting

### 🗄️ **Database Schema Extractor** (v0.2.6)
Extracts database schema from SQLite files and SQL migrations:
*   **SQLite files** (`.db`, `.sqlite`, `.sqlite3`) → table structure + Mermaid ER diagram
*   **SQL migrations** → parsed CREATE TABLE/INDEX statements
*   Outputs SQL schema + visual Mermaid diagram for AI context
*   Disabled via `projectBundler.extractDatabaseSchema` setting

### 🎯 **Context Presets** (v0.2.7 - Early Access)
Pre-configured filters for common AI workflows:
*   **🟢 Minimal Preset** — "How to run the project?"
    *   Entry points + config files + root documentation
    *   Maximum 10 files (~8-10k tokens)
    *   Use case: Quick onboarding, "make it work" questions
*   **🔵 Architecture Preset** — "How is the project structured?"
    *   Interfaces, types, configs, shallow source files (depth ≤3)
    *   Excludes files >15KB to prevent token bloat
    *   Maximum 40 files (~40-50k tokens)
    *   Use case: Architecture discussions, refactoring planning
*   **🔴 Debug Preset** — "Where might the problem be?"
    *   Prioritized: recently modified → error-prone paths → entry points
    *   Maximum 25 files (~50-60k tokens)
    *   Use case: Debugging with AI, bug investigation
*   **⚪ Selected** — Your manual selection with transparency
    *   Shows "Top heavy files" in header for token clarity
    *   Example: `src/jsonTransformer.ts (~24k tokens, 17.4 KB)`
*   **⚪ Full** — Complete project (default)

Presets use intelligent scoring with sharp weights:
*   Entry points: +1000, Config files: +500, Interfaces: +200
*   Heavy penalties: Tests -500, Binaries -1000, Large files -100 per 10KB over 20KB
*   Hard constraints prevent "preset drift" (all presets feeling the same)

### 📝 **Unified Markdown Format** (v0.2.7)
All presets now use a consistent, LLM-optimized Markdown format:
*   **Emoji Markers** — Quick preset identification (🟢 Minimal, 🟡 Architecture, 🔴 Debug, 🔵 Full, ✨ Selected)
*   **Top Heavy Files Table** — Token transparency showing largest files by token count
*   **Structured Project Tree** — Hierarchical view with token counts per file
*   **Syntax-Highlighted Code Blocks** — Language-specific formatting for 20+ languages
*   **Visual Markers** — `⚠️ [excluded]` for excluded files, `📦 [binary]` for binary files
*   **Context Modules** — Extensible sections for Database Schema, Infra, API (future-ready)
*   **Mermaid Diagrams** — Architecture preset includes dependency graph visualization

**Example Output:**
```markdown
# 🟢 Project Bundle — Minimal Preset

**Root:** /path/to/project  
**Preset:** Minimal  
**Files Included:** 10  
**Estimated Tokens:** ~10k  

## Top Heavy Files
| File | Tokens | Size |
|------|--------|------|
| package.json | ~200 | 5 KB |
| index.ts | ~1.2k | 12 KB |

## Project Structure
- **src/**
  - **index.ts** (~1.2k tokens)
- **package.json** (~200 tokens)

## File Contents
```typescript
// index.ts
import { run } from './app';
run();
```
```

*Disabled via `projectBundler.useMarkdownFormat` setting (Default: `true`)*

**File Extension:**
- Auto-saved bundles use `.md` extension for new Markdown format (better editor support)
- Legacy format continues to use `.txt` extension

### 📁 **Interactive Folder Selection** (v0.2.6)
Select which folders to include in the bundle:
*   Right-click → "Select Folders to Include... (EA)"
*   Visual checklist with Select All / Deselect All / Reset
*   Nested folder tree with inheritance
*   Disabled via `projectBundler.selectFolders` command

### 🌍 **Multi-language Output**
The generated bundle (headers, stats, structure notes) respects your language settings.
Supported: English, Russian, Spanish, German, French, Japanese, Chinese.

### 🔒 **Privacy-first**  
No network requests. No data collection. Works fully offline.

---

## 🧭 How to use

1. **Right-click** on any folder or file in the VS Code Explorer.
2. Select **"Prepare Context for AI..."** (conveniently at the top of the context menu).
3. Choose **"Bundle Selection (Smart)"** or select a specific context preset.
4. Paste the generated markdown directly into **ChatGPT, Claude web UI, DeepSeek / Gemini Chat or GitHub Copilot**.

---

## ⚙️ Settings

*   `projectBundler.includeFullTree`: Always include the full project tree structure (Default: `true`).
*   `projectBundler.smartTree`: Enable/disable automatic tree compression (Default: `true`).
*   `projectBundler.autoSave`: Auto-save bundles to `docs/bundles/` folder with timestamp in filename (Default: `false`).
*   `projectBundler.includeFileDate`: Include last modified date for each file in bundle. Disable to save tokens (Default: `true`).
*   `projectBundler.dateFormat`: Date format using tokens `DD`, `MM`, `YYYY` (Default: `DD.MM.YYYY`).
*   `projectBundler.timeFormat`: Time format using tokens `HH`/`hh`, `mm`, `ss` (Default: `HH:mm:ss`).
*   `projectBundler.timeFormat12h`: Use 12-hour format with AM/PM. If `false`, uses 24-hour format (Default: `false`).
*   `projectBundler.maxFiles`: Warning limit to prevent freezing on massive repos.
*   `projectBundler.language`:
  * `auto` (default) — matches VS Code UI language
  * `en`, `ru`, `es`, `de`, `fr`, `ja`, `zh-cn` — forces bundle output language
*   `projectBundler.useDependencyOrdering`: Sort files by dependency order (entry points first, then dependencies). EA-04 feature (Default: `true`).
*   `projectBundler.tokenWarningThresholds`: Show warning when bundle exceeds these token thresholds. Default: `[32000, 64000, 128000]`. Set to empty array `[]` to disable warnings.
*   `projectBundler.suppressEditorTab`: Don't open bundle in editor tab. Bundle is still copied to clipboard. Enable for clipboard-only workflow (Default: `false`).
*   `projectBundler.debugMaxAgeDays`: Maximum age (in days) for files to be considered 'recently modified' in Debug preset. Files modified within this period get higher priority (Default: `7`).
*   `projectBundler.useMarkdownFormat`: Use new unified Markdown format for all presets (v0.2.7). Includes emoji markers, Top Heavy Files table, syntax-highlighted code blocks, and context modules (Default: `true`).

### Exclusion Settings (v0.2.5)

*   `projectBundler.excludeFolders`: Folder name patterns to exclude from bundling. Supports glob suffixes/prefixes (e.g. `*_venv`, `.cache`). Matched folders are never scanned. Default includes: `.git`, `node_modules`, `venv`, `__pycache__`, `dist`, `build`, etc. See [docs/EXCLUSIONS_BY_LANGUAGE.md](docs/EXCLUSIONS_BY_LANGUAGE.md) for full list.
*   `projectBundler.binaryExtensions`: File extensions to treat as binary. These files appear in the tree but their content is never read. Default includes: `.png`, `.jpg`, `.pdf`, `.exe`, `.dll`, `.pyc`, `.pth`, `.onnx`, etc.
*   `projectBundler.userExcludes`: Additional glob patterns to exclude. Applied on top of folder and binary excludes. `.gitignore` files are merged automatically.
*   `projectBundler.customExcludes`: **Deprecated** (v0.2.5). Use `projectBundler.userExcludes` instead. Kept for backward compatibility.

### Content Transformers (v0.2.6)

*   `projectBundler.transformJsonFiles`: Transform JSON files to AI-friendly YAML-like format. Saves 60-90% tokens on `package-lock.json`, `tsconfig.json`, etc. (Default: `true`).
*   `projectBundler.extractDatabaseSchema`: Extract database schema from SQLite files and SQL migrations. Outputs SQL + Mermaid ER diagram for AI context. (Default: `true`).
*   `projectBundler.includeDocsFromGitignore`: Include `docs/` folder in bundle even if it is listed in `.gitignore`. Useful for AI documentation bundles. (Default: `false`).
*   `projectBundler.useBundlerignore`: Enable `.bundlerignore` file support. This file works like `.gitignore` but only for PromptPack. (Default: `true`).

---

## 💎 Free vs Pro

We believe in a usable Free tier, not a crippled demo.

### 🎁 Early Access (Until v1.0)

**All features are currently free until v1.0.**

Early users will keep access to Pro features as a thank you for feedback and support.

### Planned Tier Split (v1.0)

| Feature | Free | Pro (v1.0) |
| :--- | :---: | :---: |
| **Context Builder** (Manual selection) | ✅ | ✅ |
| **Code Context** | ✅ | ✅ |
| **File Tree Context** | ✅ | ✅ |
| **Token Stats** | ✅ | ✅ |
| **Ignore Engine** (.gitignore + auto rules) | ✅ | ✅ |
| **File Modification Dates** | ✅ | ✅ |
| **Auto-Save Bundles** | ✅ | ✅ |
| **`.bundlerignore` Support** | ✅ | ✅ |
| **JSON Transformer** (AI-friendly format) | ✅ | ✅ |
| **Database Schema Extractor** | ✅ | ✅ |
| **Smart Tree Compression** | ✅ | ✅ |
| **Context Presets** (Minimal, Arch, Debug) | ✅ | ✅ |
| **Interactive Folder Selection** | ✅ | ✅ |
| **File Ordering Engine** | ✅ | ✅ |
| **Token Warning Thresholds** | ✅ | ✅ |
| **Suppress Editor Tab** | ✅ | ✅ |
| **API Context** | ❌ | ✅ |
| **Infra Context** | ❌ | ✅ |
| **Priority Support** | ❌ | ✅ |

> **Philosophy:** Free gives results. Pro makes them better.

---

## ❓ Troubleshooting

**Q: I accidentally clicked "No" on the Smart Tree dialog. How do I enable it?**
A: Open Command Palette (`Ctrl+Shift+P`) and run **"BUNDLER: Reset Settings & Early Access"**. Next time you bundle, it will ask you again.

**Q: Does it send my code anywhere?**
A: No. Everything runs locally on your machine.

**Q: The tree shows system folders like `usr/` or unrelated projects.**
A: This was a known bug fixed in v0.2.2. Update the extension. If it persists, check that your workspace is not opened at `/` or another
very high-level path — the extension will now handle this automatically, but adding heavy folders to `customExcludes` can speed up scanning.

---

## 🧪 Testing & Validation

### Run Tests
```bash
npm run test          # Run 24 unit tests for TreeGenerator
npm run test:coverage # Run tests with NYC coverage report
```

### Pre-publish Validation
```bash
npm run validate      # Full validation pipeline:
                      # - TypeScript compile
                      # - ESLint
                      # - Unit tests
                      # - Version format check
                      # - CHANGELOG entry check
                      # - README ↔ settings sync check
                      # - Required files check
```

### Code Coverage
Current coverage: **97.77%** (24 tests covering TreeGenerator core logic).

HTML report available at `coverage/index.html` after running tests.

---

## 🧩 Philosophy

PromptPack is intentionally simple.

It does one thing well:

> **controls and shapes context before you talk to AI**

This extension is part of a broader idea:
**Context control > prompt magic**

---

## 📜 License

MIT License.

---

## 🙌 Contributing

Issues and feature requests are welcome.
Pull requests are appreciated.

---

Created by **Vitorio UI**
VS Code Marketplace publisher: `vitorioui`
