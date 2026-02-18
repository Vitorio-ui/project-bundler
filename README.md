# 📦 Project Bundler — Context Builder for AI

<div align="center">
  <img src="icon.png" width="128" height="128" alt="Context Builder Logo">
  
  <p><strong>One-click project context for Gemini, ChatGPT, Claude, DeepSeek amd LLMs.</strong></p>

</div>

---

Project Bundler helps you package your project structure and selected source code
into a single, clean, AI-friendly text bundle — ready to paste into any LLM.

**Stop copying files manually. Start building better context.**

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

## 🚀 Features

### 🧠 Smart Tree (Early Access)
Instead of dumping a 500-file tree structure, Project Bundler intelligently collapses folders irrelevant to your selection.
*   **Focus:** Shows context only around selected files.
*   **Compression:** Collapses unrelated folders (e.g., `tests/ ... [collapsed: 42 files]`).
*   **Token Savings:** Reduces visual noise and token count significantly.
*   **Auto Root Detection:** The project root is automatically inferred from your selection — no need to open VS Code at the project folder. 
    Works correctly even when opened at `/` or a high-level system path.
*   **Context Siblings:** Shows ±2 files around each selected item so you always see what's nearby, not just the selected file in isolation.

### 📊 Token Stats (Free)
Every bundle includes:
*   Estimated token count (tree + content)
*   Total size in KB
*   Helps avoid LLM context overflow

### 🌍 Polyglot Support
Works out-of-the-box with pre-configured ignore rules for:
*   **Web:** JS/TS, React, Vue, HTML/CSS
*   **Backend:** Node.js, Python (`__pycache__` ignored), Go (`vendor` ignored)
*   **Systems:** C++, Rust (`target` ignored), Java/Kotlin
*   **Common:** `.git`, `.vscode`, lockfiles, binary artifacts are excluded automatically.

### 🌍 **Multi-language Output**
The generated bundle (headers, stats, structure notes) respects your language settings.
Supported: English, Russian, Spanish, German, French, Japanese, Chinese.

### 🔒 **Privacy-first**  
No network requests. No data collection. Works fully offline.

---

## 🧭 How to use

1.  **Right-click** on any folder or file in VS Code Explorer.
2.  Look for **"Prepare Context for AI..."** (it's at the top of the menu).
3.  Choose **"Bundle Selection (Smart)"** or another preset.
4.  Paste into your favorite LLM.

---

## ⚙️ Settings

*   `projectBundler.smartTree`: Enable/disable automatic tree compression (Default: `true`).
*   `projectBundler.maxFiles`: Warning limit to prevent freezing on massive repos.
*   `projectBundler.binaryExtensions`: List of file extensions to skip content from.
*   `projectBundler.customExcludes`: Add your own glob patterns to the ignore list.
*   `projectBundler.language`:
  * `auto` (default) — matches VS Code UI language
  * `en`, `ru`, `es`, `de`, `fr`, `ja`, `zh-cn` — forces bundle output language

---

## 💎 Free vs Pro

We believe in a usable Free tier, not a crippled demo.

| Feature | Free (Early Access) | Pro (v1.0 Goal) |
| :--- | :---: | :---: |
| **Context Builder** (Manual selection) | ✅ | ✅ |
| **Full Project Tree** | ✅ | ✅ |
| **Token Stats** | ✅ | ✅ |
| **Ignore Engine** (.gitignore + auto rules) | ✅ | ✅ |
| **Custom Excludes** (manual ignore rules) | ❌ | ✅ |
| **Smart Tree Compression** | ✅ (Opt-in) | ✅ |
| **Context Presets** (Minimal, Arch, Debug) | ❌ | ✅ |
| **File Ordering Engine** | ❌ | ✅ |
| **Priority Support** | ❌ | ✅ |

> **Note on Early Access:** Smart Tree is a premium feature. It is currently enabled for all users to gather feedback. In version 1.0, it will be part of the Pro plan.

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
