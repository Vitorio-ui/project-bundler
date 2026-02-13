# 📦 Context Builder for AI

<div align="center">
  <img src="icon.png" width="128" height="128" alt="Context Builder Logo">
  
  <p><strong>One-click project context for Gemini, ChatGPT, Claude, DeepSeek amd LLMs.</strong></p>

</div>

---

Stop copy-pasting files into AI chat.

**Context Builder for AI** packs your project structure and selected code
into a single, AI-friendly text bundle — in one click.

Perfect for architecture discussions, refactoring, debugging,
and onboarding with LLMs.

---

## ✨ Features

*   **Smart Tree:** Visualizes your project structure (ASCII art).
*   **Context Aware:** If you select only `main.py`, the bundle will still show the *entire* file tree (marking other files as `[excluded]`), so the AI understands where your file lives.
*   **Ignore Engine:** Automatically respects `.gitignore`. No more `node_modules` or `.env` secrets in your prompts.
*   **Token Optimized:** Automatically excludes binary files (images, PDFs) to save tokens.
*   **Clipboard Ready:** Automatically copies the result to your clipboard.
*   **Multi-Language:** 🇷🇺 Russian, 🇺🇸 English, 🇪🇸 Spanish, 🇨🇳 Chinese, 🇩🇪 German, 🇫🇷 French, 🇯🇵 Japanese.

## 🚀 Usage

1.  **Right-click** on any file or folder in Explorer.
2.  Select **`BUNDLER: Собрать выбранное`** (Bundle Selected).
3.  Paste into Gemini/ChatGPT/Claude!

*Or use the Command Palette (`Ctrl+Shift+P`) -> `BUNDLER`.*

    Note: The extension automatically copies the generated bundle to your clipboard for instant use with AI models.

## 🔧 Settings

*   `projectBundler.includeFullTree`: 
    *   `true` (default): Show the full project tree even when bundling only 1 file.
    *   `false`: Show tree only for selected files.
*   `projectBundler.maxFiles`: Warning threshold for large repos.

## 💰 Pricing

**Early Access Phase:**
*   ✅ **Free to use**
*   ✅ **Auto-copy enabled**
*   ⚠️ **Daily Limit:** 10 bundles/day (server protection)
*   ⚠️ **File Limit:** 100 files/bundle

*Pro version with unlimited access, presets, and token estimation is currently in development.*

---

*Created by Vitorio Team.*