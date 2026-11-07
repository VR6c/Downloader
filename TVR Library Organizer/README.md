# TVR Studio ⚡ (2-in-1 DJ Suite)
> **Tag Editor, Rekordbox Library Organizer & Media Downloader 2-in-1 Desktop Suite**  
> *Target Platforms: macOS (Apple Silicon & Intel) & Windows 10/11 (64-bit)*  
> *Architecture: Electron + React 19 + TypeScript + Python Core (`yt-dlp` + FFmpeg) + Native Audio Tooling (`node-id3`, `music-metadata`)*

---

## 🎧 Overview

**TVR Studio** combines a high-performance **Media Downloader** (YouTube & SoundCloud stream extraction) and an unrestricted **Tag Editor & DJ Library Organizer** into a single, unified 2-in-1 desktop workstation.

It connects the entire DJ music curation workflow without needing external tools or subscription services:

```
[📥 Media Downloader] ──▶ [⚡ 1-Click Send to Tag Editor] ──▶ [🏷️ Auto-Clean & DSP Key/BPM] ──▶ [💾 In-Place Rename & Rekordbox Export]
```

---

## ⚡ Key Features & Capabilities

### 1. 📥 High-Fidelity Media Downloader (YouTube & SoundCloud)
- **Multi-Platform Extractor**: Downloads tracks and videos from **YouTube**, **YouTube Music**, **YouTube Shorts**, and **SoundCloud**.
- **Lossless / High-Bitrate Formats**:
  - **MP3 Audio**: Studio quality (320 kbps CBR), High (256 kbps), Standard (192 kbps), and Compact (128 kbps).
  - **MP4 / MOV Video**: Auto Best, 4K (2160p), 2K (1440p), 1080p FHD, 720p HD, and 480p SD.
- **Smart URL Parsing & Instant Fetch**: Auto-detects platform, fetches thumbnail, title, channel, duration, and upload date before downloading.
- **Auto-Clipboard Detection**: Automatically detects YouTube and SoundCloud URLs copied to the system clipboard.
- **Real-Time Progress & Metrics**: Live speed (KiB/s or MiB/s), ETA countdown, download size progress, and phase badges (*Connecting*, *Downloading*, *Encoding MP3*, *Embedding ID3 Tags*).
- **Batch Download Queue**: Paste multiple URLs for unattended sequential processing with 1-click **"Send All to Tag Editor"**.
- **Download History**: Searchable archive of past downloads with direct playback and Finder/Explorer reveal.
- **In-App Engine Updater**: Update `yt-dlp` directly from the UI with 1 click.

### 2. 🏷️ Tag Editor & Rekordbox Library Organizer
- **Spreadsheet Data Grid**: Multi-cell selection, inline editing, and bi-directional copy/paste with Microsoft Excel, Apple Numbers, and Google Sheets.
- **Automated Cleaner Engine**: Instantly strips promotional noise (`HBD To...`, `RockTheBeat`, `Free Download`, `320kbps`, social handles) and standardizes mix version brackets (`(VIP Mix)`, `(Extended Mix)`).
- **DSP Audio Analysis Engine**: High-accuracy energy onset BPM detection and 12-semitone chromagram profile matching for harmonic Camelot Key calculation (`8A`, `11B`, etc.).
- **Interactive Camelot Wheel Visualizer**: 24-key harmonic mixing wheel showing compatible key transitions.
- **Pioneer Rekordbox & CDJ Compliance**: Direct ID3v2.3 tag serialization in UTF-16 encoding (`TIT2`, `TPE1`, `TBPM`, `TKEY`) for instant standalone CDJ playback.
- **In-Place File Renaming**: Renames files directly on disk and USB drives matching configurable templates (`{Artist} - {Title} ({Mix}).ext`).
- **Waveform Audition Player**: Bottom dock audio player with interactive waveform, cue jump points (`INTRO`, `DROP 1`, `BREAK`, `OUTRO`), and tempo pitch slider (`±8%`).
- **Multi-Format Export**: Official Pioneer Rekordbox XML (`rekordbox.xml`), M3U8 playlists, CSV spreadsheets, and TXT setlists.

---

## 🎨 Themes

- **Light Mode (Default)**: Pristine, modern studio aesthetic with crisp borders, refined typography, and vivid Camelot harmonic tags.
- **Dark Mode**: Sleek obsidian and charcoal DJ booth palette with glowing neon harmonic accents.
- Toggle between modes anytime via the sun/moon button in the top-right header.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (Node 22 recommended)
- **Python**: 3.10+ (for hot-reload dev mode) or the bundled standalone `python-dist/engine`

### 1. Run in Development Mode
```bash
cd "TVR Library Organizer"
npm run electron:dev
```
Launches the native desktop application with full hot-reloading for both React and Electron.

### 2. Run in Web / Browser Mode (PWA)
The web version is the **Downloader only** and installs as a PWA. Downloads run on the server in `api/index.py`, which wraps `python/engine.py`; finished files are saved to the browser's Downloads folder.
```bash
# Terminal 1: download API (Python 3.12+)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt uvicorn
.venv/bin/uvicorn api.index:app --port 8000

# Terminal 2: web app (proxies /api to port 8000)
npm run dev
```
Opens at `http://localhost:5173`.

**Deploying to Vercel:** import the repo with `TVR Library Organizer` as the Root Directory. `vercel.json` builds the PWA and deploys `api/index.py` as a Python function (300 s limit).
- YouTube often blocks Vercel's data-center IPs ("Sign in to confirm you're not a bot"); SoundCloud usually works.
- Each download must finish within 300 s, including sending the file back.
- Optional env vars: `TVR_RATE_LIMIT_PER_HOUR` (default 30 per IP, per warm instance), `TVR_ALLOWED_ORIGINS` (CORS, default `*`), and `VITE_TVR_API_BASE` at build time to point the PWA at a download server hosted elsewhere.

### 3. Production Build
```bash
# Build web bundle
npm run build

# Package native macOS app (.dmg and .zip)
npm run build:mac

# Package native Windows installer (.exe)
npm run build:win
```

---

## 📂 Project Architecture

```
TVR Library Organizer/
├── electron/
│   ├── main.cjs            # App lifecycle: window, media protocol, wires up IPC modules
│   ├── ipc/
│   │   ├── tagEditor.cjs   # Dialogs, batched metadata reads, ID3 save/rename, playlist export
│   │   ├── downloader.cjs  # Engine status/update, media info, download start/cancel, shell helpers
│   │   └── window.cjs      # Minimize / maximize / close
│   ├── lib/
│   │   ├── platform.cjs      # Engine + FFmpeg binary resolution, URL validation
│   │   ├── id3.cjs           # Tag building, collision-safe rename (single source for save + batch)
│   │   └── engineProcess.cjs # One-shot Python engine runner (spawn + timeout + settle-once)
│   ├── preload.cjs         # contextBridge security boundary exposing window.api and window.tvr
│   └── waitAndStart.cjs    # Development launcher
├── src/
│   ├── hooks/
│   │   ├── useTrackLibrary.ts     # Library state: tracks, selection, filters, cleaning, paste/copy
│   │   ├── useSaveTracks.ts       # Write tags + rename on disk, sync results into state
│   │   ├── useDspAnalysis.ts      # Batch BPM / key analysis with bounded worker pool
│   │   ├── useToasts.ts · usePersistentState.ts · useGlobalShortcuts.ts
│   ├── components/
│   │   ├── ui/                    # Reusable primitives: Button, Input, Card, Badge, SearchBar, Modal
│   │   ├── Header.tsx             # 2-in-1 Mode Switcher (Downloader ⟷ Tag Editor), metrics & actions
│   │   ├── downloader/            # Downloader React components
│   │   │   ├── DownloaderView.tsx         # Master downloader view coordinator
│   │   │   ├── SingleDownloadTab.tsx      # URL fetch, quality selector, active progress & Tag Editor bridge
│   │   │   ├── BatchQueueTab.tsx          # Multi-link batch queue manager & bulk Tag Editor export
│   │   │   ├── DownloadHistoryTab.tsx     # Searchable download history with 1-click Tag Editor load
│   │   │   └── DownloaderSettingsTab.tsx  # yt-dlp diagnostics & dynamic updater
│   │   ├── Toolbar.tsx            # Tag editor search, filters, view presets, auto-clean, find & replace
│   │   ├── Dropzone.tsx           # Drag & drop file/folder ingestion
│   │   ├── TrackGrid.tsx          # Spreadsheet data grid with inline editing & copy/paste
│   │   ├── AudioPlayer.tsx        # Waveform audition player with cue points
│   │   ├── CamelotWheelModal.tsx  # Interactive 24-key harmonic mixing wheel
│   │   ├── CleanSettingsModal.tsx # Cleaner rules, noise word list & template editor
│   │   ├── BulkEditModal.tsx      # Multi-track batch tag updater
│   │   ├── ExportModal.tsx        # Rekordbox XML, M3U8, and CSV exporter
│   │   └── Toast.tsx              # Toast notification system
│   ├── engine/
│   │   ├── cleaner.ts             # Regex-driven promo noise cleaner
│   │   ├── dspEngine.ts           # Energy onset BPM & Chromagram Camelot Key detector
│   │   └── templateEngine.ts      # Configurable filename template serializer
│   ├── services/
│   │   ├── apiBridge.ts           # Audio metadata & file system bridge
│   │   └── downloaderService.ts   # Downloader IPC bridge & local storage persistence
│   └── styles/
│       ├── index.css              # Core design tokens, light/dark themes, and mode switcher
│       ├── grid.css               # Spreadsheet styles
│       ├── modals.css             # Dialog & popup styling
│       └── downloader.css         # Media downloader styling
├── python/
│   ├── engine.py           # yt-dlp & FFmpeg core engine with JSON IPC streaming
│   └── requirements.txt    # Python dependencies
├── python-dist/            # Frozen standalone engine binary
├── bin/                    # Platform FFmpeg & FFprobe binaries (mac, win, linux)
└── package.json            # Unified dependencies and packaging configuration
```

---

## 📦 Building & Releasing

### Local development build
```bash
npm install
npm run fetch:ffmpeg      # downloads the bundled FFmpeg/FFprobe for your OS (they are not in git: >100 MB)
npm run build:engine      # PyInstaller -> python-dist/engine  (needs: pip install -r python/requirements.txt pyinstaller)
npm run build:mac         # or build:win / build:linux
```
`build:engine` and `build:*` must run on the OS you are targeting: PyInstaller cannot cross-compile, so a Windows
`engine.exe` can only be produced on Windows (or in CI). On macOS the engine is universal2 by default; set
`TVR_TARGET_ARCH=native` to build for the current CPU only.

### Installers for every OS (GitHub Actions)
`.github/workflows/desktop-release.yml` builds each OS on its own runner:

| OS | Output | Notes |
|---|---|---|
| macOS | `.dmg` + `.pkg` for Apple Silicon and Intel | universal engine and FFmpeg |
| Windows | NSIS installer + portable `.exe` | builds `engine.exe` natively |
| Linux | `.AppImage` | static FFmpeg |

- **Try it:** GitHub → Actions → *Desktop Installers* → *Run workflow*. Installers appear as run artifacts.
- **Release:** push a tag (`git tag v2.1.0 && git push origin v2.1.0`). A **draft** GitHub Release is created with every
  installer attached; review it, then publish.

### Versions & update notifications
The app shows its version in the header and in **Downloader → Settings → About**, and tells users when a newer
GitHub Release exists (a quiet check shortly after launch, at most every 6 hours, plus **Check for updates**).
It points users to the right installer for their OS and chip; it never installs anything by itself, so it works
for unsigned builds too. (Silent auto-update on macOS requires a signed, notarized app.)

To release a new version:
1. Set the new `version` in `TVR Library Organizer/package.json` (and the root `package.json`) and commit it.
2. Tag exactly that version and push: `git tag v2.1.0 && git push origin v2.1.0`.
3. When the workflow finishes, open the **draft** release, review the notes, and publish it. Users only see
   *published* releases.

CI refuses a tag that does not match `package.json`: the app compares the two, so a mismatch would show every user a
permanent "update available" prompt. `npm run test:unit` covers the version-comparison and update-check logic.

### Code signing (not set up yet)
Installers are currently unsigned, so users see OS warnings:
- **macOS** needs an Apple Developer ID certificate + notarization. Until then users must approve the app in
  *System Settings → Privacy & Security → Open Anyway* (macOS 15+ removed the right-click → Open bypass), or run
  `xattr -dr com.apple.quarantine "/Applications/TVR Studio.app"`.
- **Windows** shows a SmartScreen warning until the installer is signed with a code-signing certificate.

