# TVR Studio ⚡ (Rekordbox DJ Suite & Web App)

> **Professional Rekordbox DJ Library Organizer, Tag Editor & High-Speed Media Downloader 2-in-1 Suite**  
> *Deployable to Vercel (Web SPA) and packaged for macOS & Windows (Electron).*

---

## 🚀 Live Web Deployment & Hosting

### Option 1: Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. **Push this repository to GitHub** (see instructions below).
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **"Add New Project"**.
3. Import your GitHub repository.
4. **Configuration Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (Default) or select `TVR Library Organizer`
   - **Build Command**: Automatically configured by `vercel.json` (`npm --prefix "TVR Library Organizer" run build`)
   - **Output Directory**: Automatically configured (`TVR Library Organizer/dist` or `dist`)
5. *(Optional)* **Environment Variables**:
   - `VITE_API_BASE_URL`: If you host the Python FastAPI backend separately (e.g. on Railway, Render, Fly.io, or VPS), set this variable to your backend URL (e.g. `https://api.yourdomain.com`).
6. Click **Deploy**! 🚀

---

## 🛠️ GitHub Repository Setup

To push this repository to GitHub for the first time:

```bash
# 1. Add all source files
git add .

# 2. Create the initial commit
git commit -m "feat: Initial commit of TVR Studio web & desktop suite"

# 3. Rename branch to main
git branch -M main

# 4. Link your remote GitHub repository (replace with your repo URL)
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# 5. Push to GitHub
git push -u origin main
```

---

## 💻 Local Development

### 1. Web Development (Vite + React 19)

```bash
# Start frontend with fast hot-reloading
npm run dev
# Opens at http://localhost:5173
```

### 2. Full-Stack Web Mode (FastAPI Backend + Vite Frontend)

```bash
# Run both the Python API and the Vite frontend concurrently
npm run web:dev
```

### 3. Production Web Build

```bash
# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview
```

### 4. Desktop Mode (Electron)

```bash
# Run native Electron app in dev mode
npm run electron:dev
```

---

## 📁 Project Architecture

```
.
├── .github/workflows/          # GitHub Actions CI verification
├── .env.example                # Environment variable reference
├── vercel.json                 # Vercel deployment configuration
├── package.json                # Workspace proxy scripts
└── TVR Library Organizer/      # Application Core
    ├── src/                    # React 19 + TypeScript Frontend
    │   ├── components/         # Downloader, Tag Editor, Modals & UI Components
    │   ├── engine/             # Web Audio DSP BPM & Camelot Key, Cleaner & Template Engine
    │   └── services/           # Downloader API Bridge & Audio Tag Bridge
    ├── python/                 # FastAPI server, yt-dlp & FFmpeg engine
    │   ├── server.py           # REST & SSE streaming server
    │   └── requirements.txt    # Python backend dependencies
    ├── electron/               # Native Electron desktop wrapper
    ├── vite.config.mjs         # Vite configuration with proxy & dynamic base
    └── vercel.json             # Subfolder Vercel configuration
```

---

## 🌐 Web Mode vs Native Desktop Mode

| Feature | Web Mode (Vercel) | Native Desktop (Electron) |
| :--- | :---: | :---: |
| **Pioneer Rekordbox Tag Editing** | ✅ In-Browser | ✅ Native Direct Disk I/O |
| **Web Audio DSP (BPM & Camelot Key)** | ✅ High Accuracy (Web Audio API) | ✅ High Accuracy (Web Audio API) |
| **Rekordbox XML & M3U8 Export** | ✅ Instant Download | ✅ Direct File Export |
| **Spreadsheet Grid & Bulk Clean** | ✅ Full Support | ✅ Full Support |
| **Media Downloader (YouTube/SoundCloud)**| ⚡ Connects via `VITE_API_BASE_URL` | ⚡ Bundled Python Core |
