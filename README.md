# 📦 Project Bundler — Context Builder for AI

**One-click project context builder for ChatGPT, Claude and other LLMs.**

<div align="center">
  <img src="icon.png" width="128" height="128" alt="Context Builder Logo">
  
  <p><strong>One-click project context for Gemini, ChatGPT, Claude, DeepSeek amd LLMs.</strong></p>

</div>

---

Project Bundler helps you package your project structure and selected source code
into a single, clean, AI-friendly text bundle — ready to paste into any LLM.

> No servers. No telemetry. Fully local.

---

## 🚀 Why Project Bundler?

Working with AI on real projects is painful:

- You copy one file…
- then another…
- then explain the folder structure manually…

**Project Bundler solves this in one click.**

It generates:
- a readable ASCII tree of your project
- full contents of selected files
- a clear separation between structure and code

Perfect for:
- architecture discussions
- refactoring with AI
- debugging with full context
- onboarding AI into existing projects

---

## ✨ Features (MVP)

- 📁 **Project Tree Visualization**  
  Generates a clean ASCII tree of your project structure.

- 🎯 **Selective Context**  
  Bundle only selected files while still showing the full project tree  
  (non-included files are marked as `[excluded]`).

- 🙈 **Smart Ignore Engine**  
  Respects `.gitignore` and common exclusions (`node_modules`, `.git`, binaries, etc.).

- 🌍 **Multi-language UI**  
  English, Russian, Spanish, German, French, Japanese, Chinese.

- 🔒 **Privacy-first**  
  No network requests. No data collection. Works fully offline.

---

## 🧠 How it works

1. Right-click on a file or folder in VS Code
2. Choose **“BUNDLER: Bundle selected”**
3. Paste the generated bundle into ChatGPT / Claude / LLM

That’s it.

---

## 🧭 Usage

### Bundle selected files
- Select one or more files/folders in Explorer
- Right-click → **BUNDLER: Bundle selected**

### Bundle entire project
- Open Command Palette (`Ctrl+Shift+P`)
- Run **BUNDLER: Bundle entire project**

---

## 🌍 Language

Project Bundler automatically uses the VS Code UI language.

No manual language selection is required.

---

## ⚙️ Settings

Project Bundler can be configured via VS Code settings.

### `projectBundler.includeFullTree`
- **Type:** boolean  
- **Default:** `true`

Always show the full project tree, even when bundling only selected files.
When disabled, the tree will include only bundled files.

---

### `projectBundler.binaryExtensions`
- **Type:** array of strings  
- **Default:** common binary formats (`.png`, `.jpg`, `.zip`, etc.)

List of file extensions whose contents will be skipped.
This prevents binary or non-text files from polluting the bundle output.

The files will still appear in the project tree, but their contents will not be included.

---

### `projectBundler.maxFiles`
- **Type:** number  
- **Default:** safe preset (e.g. 300)

Soft safety limit.
When the number of files exceeds this value, Project Bundler shows a warning
to prevent accidental freezes on large monorepositories.

This does **not** block bundling — it is only a warning.

---

## 📄 Output format

The generated bundle contains:

* project metadata
* full project tree
* clearly separated file contents
* explicit start/end markers per file

Designed to be:

* readable by humans
* friendly for LLM tokenizers

---

## 🔐 Privacy

Project Bundler:

* does NOT collect any data
* does NOT send network requests
* does NOT track usage
* works 100% locally

---

## 🔮 Planned features (in development)

These features are **not implemented yet**, but planned:

* Context presets (Architecture / Debug / Minimal)
* Token-aware bundling
* Output templates
* Bundle size hints for LLMs
* Optional Pro features (details later)

---

## 🧩 Philosophy

Project Bundler is intentionally simple.

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
