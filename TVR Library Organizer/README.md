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

### 2. Run in Web / Browser Mode
```bash
npm run dev
```
Starts the Vite dev server at `http://localhost:5173`.

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
│   ├── main.cjs            # Unified Electron main process (IPC handlers for native audio I/O & Python engine)
│   ├── preload.cjs         # contextBridge security boundary exposing window.api and window.tvr
│   └── waitAndStart.cjs    # Development launcher
├── src/
│   ├── components/
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
