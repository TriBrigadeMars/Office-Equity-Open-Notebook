<p align="center">
  <img src="https://raw.githubusercontent.com/lfnovo/open-notebook/main/logo.png" alt="logo" width="120" />
</p>

<h1 align="center">Office of Equity Open Notebook</h1>

<p align="center">
  A private, multi-model, 100% local Windows desktop app built on<br/>
  <a href="https://github.com/lfnovo/open-notebook">Open Notebook</a> — the open source alternative to Google's Notebook LM.
</p>

<p align="center">
  <a href="#-what-is-it">What Is It</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-installation">Installation</a> ·
  <a href="#-building-from-source">Build</a> ·
  <a href="#-configuration">Config</a> ·
  <a href="#-what-we-built">What We Built</a> ·
  <a href="#-license">License</a>
</p>

---

## 📖 What Is It?

**Office of Equity Open Notebook** is a self-contained Windows desktop application built for the **Office of Equity**. It wraps the full [Open Notebook](https://github.com/lfnovo/open-notebook) stack — a private, multi-model, 100% local alternative to Notebook LM — into a single installable Electron application with zero Docker or system dependency requirements.

> **Open Notebook** empowers you to control your data, choose your AI models (18+ providers including OpenAI, Anthropic, Ollama, and LM Studio), organize multi-modal content, generate professional podcasts, search intelligently, and chat with context — all powered by your research materials. Learn more at [open-notebook.ai](https://www.open-notebook.ai).

### What makes this version different?

Unlike the upstream project (which runs via Docker), **this version is a native Windows desktop app**:

| Capability | Upstream (Docker) | This Desktop App |
| --- | --- | --- |
| **Installation** | Requires Docker Desktop | Single installer (.exe) — no Docker |
| **Runtimes** | Container-managed | Bundled Python 3.12 + Node.js |
| **Database** | Containerized SurrealDB | Bundled SurrealDB binary |
| **Docling Engine** | Opt-in, installed on first boot | Pre-installed in the runtime |
| **Offline** | Needs network for first boot extras | Fully offline after install |
| **User Data** | Docker volume | `%APPDATA%\Office of Equity Open Notebook` |

---

## ✨ Features

Everything from upstream **Open Notebook**, plus desktop-specific additions:

### Core Capabilities
- **🤖 Multi-Model AI Support** — 18+ providers including OpenAI, Anthropic, Ollama, Google, LM Studio, and more
- **🎙️ Professional Podcast Generation** — Advanced multi-speaker podcasts with custom speaker profiles
- **🔍 Intelligent Search** — Full-text and vector search across all your content
- **💬 Context-Aware Chat** — AI conversations powered by your research materials
- **📝 AI-Assisted Notes** — Generate insights or write notes manually

### Advanced Features
- **⚡ Reasoning Model Support** — Full support for thinking models like DeepSeek-R1 and Qwen3
- **🔧 Content Transformations** — Powerful customizable actions to summarize and extract insights
- **🌐 Comprehensive REST API** — Full programmatic access (`http://localhost:5055/docs`)
- **📚 Organize Multi-Modal Content** — PDFs, videos, audio, web pages, images, and more
- **🌟 Docling Pre-Installed** — Document engine, OCR, and image source support ready out of the box
- **🔒 Encryption at Rest** — API keys encrypted with a locally-generated key

### Desktop-Specific
- **🖥️ Native Windows App** — Installs via a single .exe, runs without Docker or system Python/Node
- **🔇 Fully Hidden Services** — SurrealDB, API, worker, and frontend run with no console windows
- **📁 Portable User Data** — All data lives in `%APPDATA%`, separate from the install folder
- **🧩 Optional Runtimes** — Installer lets you skip bundled Python/Node if you already have them

---

## 📦 Installation

### Option 1: Installer (recommended)

Download the latest `Office of Equity Open Notebook-<version>-Setup.exe` from [Releases](https://github.com/oe-marscruz/Office-Equity-Open-Notebook/releases) and run it.

The installer offers three components on the **Custom Install** page:
- **Open Notebook (required)** — the app, SurrealDB, and the built frontend
- **Python 3.12 runtime** — bundled CPython + all backend dependencies (recommended)
- **Node.js runtime** — bundled Node.js for the frontend server (recommended)

If you uncheck the optional runtimes, the app will look for `python.exe` (3.11/3.12) and `node.exe` (v18+) on your PATH.

### Option 2: Run from source

```bash
git clone https://github.com/oe-marscruz/Office-Equity-Open-Notebook.git
cd office-of-equity-open-notebook
npm install
npm start
```

> See [Building from Source](#-building-from-source) below for the full pipeline including the runtime assembly.

---

## 🚀 First Launch

On first launch the app:
- Creates a user-data folder at `%APPDATA%\Office of Equity Open Notebook\`
- Generates a random encryption key (stored there) to secure your API keys at rest
- Starts SurrealDB → API → worker → frontend, then opens the UI

Service logs are written to `%APPDATA%\Office of Equity Open Notebook\logs\` (`surrealdb.log`, `api.log`, `worker.log`, `frontend.log`).

---

## 🔧 Configuration

Configure your AI provider inside the app: **Settings → API Keys**.

Supported providers include: OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek, Ollama, LM Studio, and more. You can also add a local model server (Ollama / LM Studio) and the app will discover available models automatically.

For advanced environment variables (e.g. `OLLAMA_API_BASE`), see the upstream [environment reference](https://github.com/lfnovo/open-notebook/blob/main/docs/5-CONFIGURATION/environment-reference.md).

> **Docling** (document engine, OCR, image sources) is pre-installed and enabled by default — no additional setup needed.

---

## 🛠️ Building from Source

You need `git`, `node` (18+), and `uv` on the build machine.

```bash
# 1. Clone the upstream Open Notebook repo (source for the runtime)
git clone https://github.com/lfnovo/open-notebook.git ../open-notebook

# 2. Install desktop app dependencies
cd office-of-equity-open-notebook
npm install

# 3. Assemble the self-contained runtime
#    Builds the Next.js frontend, installs Python deps (including Docling),
#    downloads SurrealDB + Node.js binaries. Needs network, ~2 GB disk.
npm run prepare:runtime

# 4. Generate the app icon (assets/icon.ico) from assets/icon.png
npm run build:icons

# 5. Run the app in dev mode
npm start

# 6. Build the unpacked app folder
npm run package:app

# 7. Build the Windows installer
#    Requires NSIS 3.x in resources/.cache/nsis/ and rcedit.exe in
#    resources/.cache/rcedit/
npm run installer

# 8. (Releases) After `gh release upload`, confirm the published asset is
#    complete: checks the NSIS length header, then the release's size + SHA-256
npm run verify:installer -- --release v<version>
```

> **App icon** — drop a square PNG (1024×1024 recommended) at `assets/icon.png`
> and run `npm run build:icons`. It generates the multi-resolution
> `assets/icon.ico` used for the window/taskbar, the packaged `.exe`, and the
> installer. If `assets/icon.png` is absent, `build-icons.js` fails with a clear
> message; `package.js` and `build-installer.js` fall back to the default
> Electron icon.
>
> **In-app branding** — the GUI itself is served by the upstream Next.js
> frontend, so its two brand surfaces (the sidebar mark left of the app name and
> the browser-tab favicon) are rebranded by `scripts/apply-branding.js` during
> `npm run prepare:runtime`. The script rewrites the upstream sidebar component
> and favicon in the temp build directory, so the `../open-notebook` clone stays
> pristine and no fork is needed. Source artwork is `assets/cu-logo.png`; drop a
> replacement there and re-run `npm run prepare:runtime -- --step frontend` to
> rebrand. `scripts/verify-runtime.js` fails the build if the branding does not
> reach the assembled runtime.

---

## 📐 What We Built

This desktop app was created by wrapping the upstream [Open Notebook](https://github.com/lfnovo/open-notebook) project in an **Electron shell** and bundling all dependencies into a self-contained runtime:

### Architecture

```
Office of Equity Open Notebook.exe
├── Electron shell          → Native Windows window + lifecycle
├── assets/icon.ico         → Window/taskbar, exe, and installer icon
├── assets/cu-logo.png      → In-GUI sidebar mark + browser favicon source
├── resources/runtime/
│   ├── backend/            → FastAPI REST API + LangGraph workflows
│   ├── frontend/           → Next.js standalone production server
│   ├── python/             → CPython 3.12 + all dependencies (incl. Docling)
│   ├── node/               → Portable Node.js (v22 LTS)
│   ├── surreal/            → SurrealDB binary
│   └── tiktoken-cache/     → Pre-downloaded encoding (offline support)
├── scripts/
│   ├── start-services.js   → Spawns SurrealDB, API, worker, frontend
│   ├── prepare-runtime.js  → Assembles the runtime from source
│   ├── build-icons.js      → Generates assets/icon.ico from assets/icon.png
│   ├── apply-branding.js   → Rebrands the upstream frontend (sidebar + favicon)
│   ├── verify-runtime.js   → Validates an assembled frontend runtime
│   ├── package.js          → Manual packaging (no electron-builder)
│   ├── build-installer.js  → NSIS installer generator
│   ├── verify-installer.js → Detects truncated installers / compares to a release asset
│   └── lib/                → Shared helpers (argv, child processes, fs, paths)
│       └── paths.js        → Single source of truth for name, dirs, and ports
└── User data → %APPDATA%\Office of Equity Open Notebook\
    ├── data/               → Uploads, podcasts, SQLite
    ├── surrealdb/          → RocksDB database files
    └── logs/               → Per-service log files
```

### Key Decisions

| Decision | Why |
| --- | --- |
| **Electron** over Tauri | Mature packaging, full API surface for process management |
| **Manual packaging** over electron-builder | Avoids symlink issues on non-admin Windows |
| **NSIS installer** | Three optional components, clean uninstall |
| **Hand-rolled icon builder** | Keeps the build dependency-free and offline-reproducible |
| **Branding as a build step, not a fork** | Upstream stays pristine and rebrands are one command, so upstream updates stay mergeable |
| **Bundled Python + Node** | Zero system dependencies for end users |
| **Docling pre-installed** | The upstream installs it on first boot; we bundle it so the app works fully offline |
| **Separate user-data folder** | User data survives app updates and uninstalls |

### Port Map

| Service | Port |
| --- | --- |
| SurrealDB | `8000` |
| FastAPI backend | `5055` |
| Next.js frontend | `8502` |

---

## 🩺 Troubleshooting

- **Ports in use** — the app checks 8000, 5055, and 8502 before starting. If any are in use, it shows an error naming the blocked port.
- **"Runtime not found"** — re-run `npm run prepare:runtime` and rebuild.
- **"Timed out waiting for Frontend on port 8502" or a blank window** — the bundled Next.js frontend is incomplete. `npm run prepare:runtime`, `package:app`, and `installer` now run `scripts/verify-runtime.js` and fail the build if it is. You can also run `node scripts/verify-runtime.js <path-to>/resources/runtime/frontend` against an existing install. Check `%APPDATA%\Office of Equity Open Notebook\logs\frontend.log` for the underlying error.
- **No AI responses** — add an API key in Settings, or configure a local model server.
- **Podcast audio** — some providers may need `ffmpeg` on your PATH.

---

## 📄 License

This project is licensed under the **MIT License**.

It bundles:
- [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) (MIT)
- [SurrealDB](https://github.com/surrealdb/surrealdb) (Business Source License 1.1)
- [Node.js](https://nodejs.org) (MIT)
- [Electron](https://www.electronjs.org) (MIT)

See the upstream `LICENSE` file in `resources/runtime/backend/LICENSE`.

---

<p align="center">
  Built with ❤️ for the Office of Equity
</p>
