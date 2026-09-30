# TVR Studio ⚡ (Desktop Suite for macOS & Windows)

> **Professional Rekordbox DJ Library Organizer, Tag Editor & High-Speed Media Downloader 2-in-1 Native Desktop Suite**  
> *Target Platforms: macOS (Apple Silicon & Intel) & Windows 10/11 (64-bit)*  
> *Architecture: Electron + React 19 + TypeScript + Python Core (`yt-dlp` + FFmpeg) + Native Audio Tooling (`node-id3`, `music-metadata`)*

---

## 🎧 Overview

**TVR Studio** combines a high-performance **Media Downloader** (YouTube & SoundCloud stream extraction) and an unrestricted **Tag Editor & DJ Library Organizer** into a single, unified 2-in-1 desktop workstation.

It connects the entire DJ music curation workflow directly on your local machine without needing external tools, browser limitations, or subscription services:

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
- **Real-Time Progress & Metrics**: Live speed, ETA countdown, download size progress, and phase badges (*Connecting*, *Downloading*, *Encoding MP3*, *Embedding ID3 Tags*).
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

## 💻 Desktop Development & Packaging

### Prerequisites
- **Node.js**: v18+ (Node 22 recommended)
- **Python**: 3.10+ (for dev mode) or bundled standalone `python-dist/engine`

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Run Desktop App in Development Mode
```bash
npm run electron:dev
```
Launches the native desktop application with full hot-reloading for both React and Electron.

### 3. Build & Package for Desktop

#### Package for macOS (.dmg and .zip)
```bash
npm run build:mac
```
Generates universal or architecture-optimized DMG and ZIP files in `TVR Library Organizer/release/`.

#### Package for Windows (.exe installer & portable)
```bash
npm run build:win
```
Generates NSIS installer and portable executables in `TVR Library Organizer/release/`.

#### Package for Both (macOS + Windows)
```bash
npm run build:all
```

---

## 📁 Repository Structure

```
.
├── TVR Library Organizer/      # Desktop Application Core
│   ├── electron/               # Electron main & preload IPC processes
│   ├── python/                 # Python yt-dlp & FFmpeg core engine
│   │   ├── engine.py           # Core extractor, transcoder, and metadata tagger
│   │   └── requirements.txt    # Desktop engine dependencies
│   ├── bin/                    # Bundled ffmpeg / yt-dlp binaries
│   ├── src/                    # React 19 + TypeScript Desktop UI
│   │   ├── components/         # Downloader, Tag Editor, Modals & UI Components
│   │   ├── engine/             # DSP Audio Engine, Cleaner & Template Engine
│   │   └── services/           # Electron IPC Bridges (apiBridge & downloaderService)
│   ├── build/                  # App icons (icns, png, ico)
│   └── package.json            # Electron builder & scripts
└── package.json                # Root proxy scripts
```
