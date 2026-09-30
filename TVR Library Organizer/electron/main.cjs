const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn, exec, execFile } = require('child_process');
const { pathToFileURL } = require('url');
const readline = require('readline');
const NodeID3 = require('node-id3');

// Register privileged scheme for streaming media
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media-stream',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
} catch (e) {
  // May already be registered or non-critical
}

let mainWindow = null;

// Track active child processes by unique download ID to support clean cancellation & prevent zombies
const activeProcesses = new Map();

function terminateAllProcesses() {
  for (const [id, proc] of activeProcesses.entries()) {
    try {
      proc.kill('SIGTERM');
    } catch (e) {
      // ignore
    }
    activeProcesses.delete(id);
  }
}

app.on('before-quit', terminateAllProcesses);

/**
 * Locate engine binary or python runtime
 */
function resolveEngineCommand() {
  const isPackaged = app.isPackaged;
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'engine.exe' : 'engine';

  // 1. Packaged extraResources location (production)
  if (isPackaged) {
    const packagedBin = path.join(process.resourcesPath, 'bin', 'engine', binaryName);
    if (fs.existsSync(packagedBin)) {
      return { executable: packagedBin, args: [], isBinary: true };
    }
    const altBin = path.join(process.resourcesPath, 'bin', binaryName);
    if (fs.existsSync(altBin)) {
      return { executable: altBin, args: [], isBinary: true };
    }
    const altDistBin = path.join(process.resourcesPath, 'python-dist', binaryName);
    if (fs.existsSync(altDistBin)) {
      return { executable: altDistBin, args: [], isBinary: true };
    }
  }

  // 2. Development: Prioritize local virtualenv Python with python/engine.py for instant startup
  const engineScript = path.join(__dirname, '..', 'python', 'engine.py');

  const venvPython = isWin
    ? path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', '.venv', 'bin', 'python3');

  if (fs.existsSync(venvPython) && fs.existsSync(engineScript)) {
    return { executable: venvPython, args: [engineScript], isBinary: false };
  }
  // 3. Local python-dist directory (PyInstaller output) fallback
  const localDistBin = path.join(__dirname, '..', 'python-dist', binaryName);
  if (fs.existsSync(localDistBin)) {
    return { executable: localDistBin, args: [], isBinary: true };
  }

  // 5. System Python fallback
  const systemPython = isWin ? 'python' : 'python3';
  return { executable: systemPython, args: [engineScript], isBinary: false };
}

/**
 * Locate FFmpeg directory
 */
function resolveFFmpegDirectory() {
  const isPackaged = app.isPackaged;
  const plat = process.platform === 'darwin' ? 'mac' : (process.platform === 'win32' ? 'win' : 'linux');

  // Check packaged resources
  if (isPackaged) {
    const resBin = path.join(process.resourcesPath, 'bin');
    if (fs.existsSync(resBin)) return resBin;
  }

  // Check workspace bin
  const localBin = path.join(__dirname, '..', 'bin', plat);
  if (fs.existsSync(localBin)) return localBin;

  const genericBin = path.join(__dirname, '..', 'bin');
  if (fs.existsSync(genericBin)) return genericBin;

  // Fallback system paths
  if (fs.existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin';
  if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) return '/opt/homebrew/bin';

  return null;
}

/**
 * Strict regex validation for YouTube and SoundCloud URLs
 */
function isValidMediaUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const regex = /^(https?:\/\/)?(www\.|m\.|music\.|on\.)?(youtube\.com|youtu\.be|soundcloud\.com)\/.+$/i;
  return regex.test(url.trim());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1060,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'TVR Studio - Tag Editor & Downloader',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows local file audio playback preview
    },
  });

  if (process.platform === 'darwin' && app.dock) {
    const dockIconPath = path.join(__dirname, '../public/music.png');
    if (fs.existsSync(dockIconPath)) {
      app.dock.setIcon(dockIconPath);
    }
  }

  const devUrl = 'http://localhost:5173';
  const prodIndex = path.join(__dirname, '../dist/index.html');

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      if (fs.existsSync(prodIndex)) {
        mainWindow.loadFile(prodIndex);
      } else {
        setTimeout(() => mainWindow.loadURL(devUrl), 1500);
      }
    });
  } else {
    mainWindow.loadFile(prodIndex);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Protocol handler for streaming local audio/video safely
    try {
      protocol.handle('media-stream', (request) => {
        try {
          const urlWithoutScheme = request.url.replace(/^media-stream:\/\//, '');
          const cleanPath = decodeURIComponent(urlWithoutScheme.replace(/^local\//, ''));
          const fileUrl = pathToFileURL(cleanPath).href;
          return net.fetch(fileUrl);
        } catch (err) {
          return new Response('File not found', { status: 404 });
        }
      });
    } catch (e) {
      // Ignore if handle not supported or already registered
    }

    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  terminateAllProcesses();
  if (process.platform !== 'darwin') app.quit();
});

// Supported audio extensions for Tag Editor
const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.aiff', '.aif']);

function isAudioFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

async function scanDirectoryRecursive(dirPath, fileList = []) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await scanDirectoryRecursive(fullPath, fileList);
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        fileList.push(fullPath);
      }
    }
  } catch (err) {
    console.error('Error scanning directory:', dirPath, err);
  }
  return fileList;
}

function registerIpcHandlers() {
  // =========================================================================
  // TAG EDITOR & LIBRARY ORGANIZER HANDLERS
  // =========================================================================

  // Open audio files dialog
  ipcMain.handle('dialog:openFiles', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audio Files for TVR Organizer',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'aiff', 'aif'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths) return [];
    return result.filePaths;
  });

  // Open directory dialog
  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Music Library Folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return [];
    const dir = result.filePaths[0];
    const audioFiles = await scanDirectoryRecursive(dir);
    return audioFiles;
  });

  // Read Audio Metadata
  ipcMain.handle('file:readMetadata', async (_, filePath) => {
    try {
      const mm = await import('music-metadata');
      const metadata = await mm.parseFile(filePath, { duration: true });
      const stats = await fsp.stat(filePath);

      const ext = path.extname(filePath).replace('.', '').toLowerCase();
      const fileName = path.basename(filePath);

      return {
        filePath,
        fileName,
        fileSize: stats.size,
        duration: metadata.format.duration || 0,
        bitrate: Math.round((metadata.format.bitrate || 0) / 1000),
        sampleRate: metadata.format.sampleRate || 44100,
        bitDepth: metadata.format.bitsPerSample || 16,
        format: ext,
        title: metadata.common.title || '',
        artist: metadata.common.artist || '',
        album: metadata.common.album || '',
        genre: metadata.common.genre ? metadata.common.genre[0] : '',
        year: metadata.common.year ? String(metadata.common.year) : '',
        trackNumber: metadata.common.track?.no ? String(metadata.common.track.no) : '',
        bpm: metadata.common.bpm || null,
        key: metadata.common.key || null,
        composer: metadata.common.composer ? metadata.common.composer[0] : '',
        comment: metadata.common.comment ? metadata.common.comment[0]?.text || '' : '',
        rating: metadata.common.rating ? metadata.common.rating[0]?.rating : 0,
      };
    } catch (err) {
      console.error('Metadata read error on', filePath, err);
      const stats = await fsp.stat(filePath).catch(() => ({ size: 0 }));
      return {
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size || 0,
        format: path.extname(filePath).replace('.', '').toLowerCase(),
        title: '',
        artist: '',
        error: err.message,
      };
    }
  });

  // Fast File Size Query
  ipcMain.handle('file:getFileSize', async (_, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') return 0;
      const stats = await fsp.stat(filePath);
      return stats.size || 0;
    } catch {
      return 0;
    }
  });

  // Save ID3v2.3 tags and rename file in-place
  ipcMain.handle('file:saveMetadataAndRename', async (_, params) => {
    const { filePath, newArtist, newTitle, newMix, album, genre, year, bpm, camelotKey, targetFileName } = params;

    try {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.mp3' || ext === '.aiff' || ext === '.aif') {
        const fullTitle = newMix && newMix !== 'Original Mix' ? `${newTitle} (${newMix})` : newTitle;
        const tags = {
          title: fullTitle,
          artist: newArtist,
          album: album || '',
          genre: genre || '',
          year: year || '',
          bpm: bpm ? String(Math.round(bpm)) : '',
          initialKey: camelotKey ? camelotKey.toUpperCase() : '',
        };
        NodeID3.write(tags, filePath);
      }

      let finalPath = filePath;
      if (targetFileName) {
        const dir = path.dirname(filePath);
        const originalExt = path.extname(filePath);
        const cleanBase = targetFileName.trim().replace(/\.[a-zA-Z0-9]+$/, '').trim();
        const resolvedFileName = originalExt ? `${cleanBase}${originalExt}` : cleanBase;
        const nextPath = path.join(dir, resolvedFileName);

        if (nextPath !== filePath) {
          await fsp.rename(filePath, nextPath);
          finalPath = nextPath;
        }
      }

      return { success: true, newFilePath: finalPath };
    } catch (err) {
      console.error('Error saving/renaming file:', filePath, err);
      return { success: false, error: err.message, filePath };
    }
  });

  // Batch process files
  ipcMain.handle('file:batchProcess', async (_, batchRequest) => {
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const results = [];

    for (const item of batchRequest.tracks) {
      try {
        const ext = path.extname(item.filePath).toLowerCase();
        if (ext === '.mp3' || ext === '.aiff' || ext === '.aif') {
          const fullTitle = item.newMix && item.newMix !== 'Original Mix' ? `${item.newTitle} (${item.newMix})` : item.newTitle;
          const trkNumStr = item.trackNumber
            ? item.tracksTotal
              ? `${item.trackNumber}/${item.tracksTotal}`
              : String(item.trackNumber)
            : '';

          const tags = {
            title: fullTitle,
            artist: item.newArtist,
            album: item.album || '',
            genre: item.genre || '',
            year: item.year || '',
            performerInfo: item.albumArtist || '',
            trackNumber: trkNumStr,
            comment: item.comments ? { language: 'eng', text: item.comments } : undefined,
            bpm: item.bpm ? String(Math.round(item.bpm)) : '',
            initialKey: item.camelotKey ? item.camelotKey.toUpperCase() : '',
          };

          if (item.artworkUrl && item.artworkUrl.startsWith('data:image/')) {
            const matches = item.artworkUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              tags.image = {
                mime: matches[1],
                type: { id: 3, name: 'front cover' },
                description: 'Cover Art',
                imageBuffer: Buffer.from(matches[2], 'base64'),
              };
            }
          }

          NodeID3.write(tags, item.filePath);
        }

        let newFilePath = item.filePath;
        if (item.targetFileName) {
          const dir = path.dirname(item.filePath);
          const originalExt = path.extname(item.filePath);
          const cleanBase = item.targetFileName.trim().replace(/\.[a-zA-Z0-9]+$/, '').trim();
          const resolvedFileName = originalExt ? `${cleanBase}${originalExt}` : cleanBase;
          const candidatePath = path.join(dir, resolvedFileName);

          if (candidatePath !== item.filePath) {
            await fsp.rename(item.filePath, candidatePath);
            newFilePath = candidatePath;
          }
        }

        successCount++;
        results.push({ id: item.id, newFilePath, status: 'saved' });
      } catch (err) {
        errorCount++;
        errors.push({ id: item.id, filePath: item.filePath, reason: err.message });
        results.push({ id: item.id, newFilePath: item.filePath, status: 'error', error: err.message });
      }
    }

    return { successCount, errorCount, errors, results };
  });

  // Export Playlist to file
  ipcMain.handle('file:exportPlaylist', async (_, params) => {
    if (!mainWindow) return false;
    const { content, defaultName, extension } = params;
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Playlist File',
      defaultPath: defaultName,
      filters: [{ name: 'Playlist', extensions: [extension] }],
    });

    if (saveResult.canceled || !saveResult.filePath) return false;
    await fsp.writeFile(saveResult.filePath, content, 'utf-8');
    return true;
  });

  // =========================================================================
  // MEDIA DOWNLOADER HANDLERS (YouTube & SoundCloud)
  // =========================================================================

  const handleGetAppInfo = async () => {
    const defaultDownloads = app.getPath('downloads');
    const ffmpegDir = resolveFFmpegDirectory();
    return {
      version: app.getVersion(),
      defaultDownloadDir: defaultDownloads,
      ffmpegDir: ffmpegDir,
      platform: process.platform,
    };
  };
  ipcMain.handle('get-app-info', handleGetAppInfo);
  ipcMain.handle('downloader:getAppInfo', handleGetAppInfo);

  const handleGetEngineStatus = async () => {
    const engine = resolveEngineCommand();
    const ffmpegDir = resolveFFmpegDirectory();

    return new Promise((resolve) => {
      let resolved = false;
      const cmdArgs = [...engine.args, '--version'];

      try {
        const proc = spawn(engine.executable, cmdArgs, { shell: false });
        let stdoutData = '';

        proc.stdout.on('data', (chunk) => {
          stdoutData += chunk.toString();
        });

        proc.on('close', (code) => {
          if (resolved) return;
          resolved = true;
          try {
            const lines = stdoutData.trim().split('\n');
            for (const line of lines) {
              const parsed = JSON.parse(line.trim());
              if (parsed.type === 'init') {
                return resolve({
                  ready: true,
                  ytdlp_version: parsed.ytdlp_version,
                  python_version: parsed.python_version,
                  ffmpeg_available: parsed.ffmpeg_available,
                  ffmpeg_path: parsed.ffmpeg_path || ffmpegDir,
                  engine_path: engine.executable,
                });
              }
            }
          } catch (e) {}
          resolve({
            ready: code === 0,
            ytdlp_version: 'available',
            python_version: 'runtime',
            ffmpeg_available: Boolean(ffmpegDir),
            ffmpeg_path: ffmpegDir,
            engine_path: engine.executable,
          });
        });

        proc.on('error', (err) => {
          if (resolved) return;
          resolved = true;
          resolve({
            ready: false,
            error: err.message,
            ffmpeg_available: Boolean(ffmpegDir),
            ffmpeg_path: ffmpegDir,
            engine_path: engine.executable,
          });
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { proc.kill(); } catch (e) {}
            resolve({
              ready: false,
              error: 'Engine handshake timed out',
              ffmpeg_available: Boolean(ffmpegDir),
              ffmpeg_path: ffmpegDir,
            });
          }
        }, 15000);
      } catch (err) {
        resolve({
          ready: false,
          error: err.message,
          ffmpeg_available: Boolean(ffmpegDir),
          ffmpeg_path: ffmpegDir,
        });
      }
    });
  };
  ipcMain.handle('get-engine-status', handleGetEngineStatus);
  ipcMain.handle('downloader:getEngineStatus', handleGetEngineStatus);

  const handleUpdateEngine = async () => {
    const engine = resolveEngineCommand();
    return new Promise((resolve) => {
      try {
        const proc = spawn(engine.executable, [...engine.args, 'update'], { shell: false });
        let lastResult = null;

        const rl = readline.createInterface({ input: proc.stdout });
        rl.on('line', (line) => {
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.type === 'update' || parsed.type === 'error') {
              lastResult = parsed;
            }
          } catch (e) {}
        });

        proc.on('close', (code) => {
          resolve(lastResult || { type: 'update', status: code === 0 ? 'success' : 'error' });
        });

        proc.on('error', (err) => {
          resolve({ type: 'update', status: 'error', message: err.message });
        });
      } catch (err) {
        resolve({ type: 'update', status: 'error', message: err.message });
      }
    });
  };
  ipcMain.handle('update-engine', handleUpdateEngine);
  ipcMain.handle('downloader:updateEngine', handleUpdateEngine);

  const handleSelectDirectory = async (_event, defaultPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder',
      defaultPath: defaultPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  };
  ipcMain.handle('select-directory', handleSelectDirectory);
  ipcMain.handle('downloader:selectDirectory', handleSelectDirectory);

  const handleGetDefaultDownloadDir = async () => app.getPath('downloads');
  ipcMain.handle('get-default-download-dir', handleGetDefaultDownloadDir);
  ipcMain.handle('downloader:getDefaultDownloadDir', handleGetDefaultDownloadDir);

  const handleFetchMediaInfo = async (_event, rawUrl) => {
    if (!isValidMediaUrl(rawUrl)) {
      return { success: false, error_code: 'ERR_INVALID_URL', message: 'Invalid YouTube or SoundCloud URL provided.' };
    }

    const cleanUrl = rawUrl.trim();
    const engine = resolveEngineCommand();
    const ffmpegDir = resolveFFmpegDirectory();

    return new Promise((resolve) => {
      let resolved = false;
      const cmdArgs = [...engine.args, 'info', cleanUrl];
      if (ffmpegDir) cmdArgs.push(ffmpegDir);

      try {
        const proc = spawn(engine.executable, cmdArgs, { shell: false });
        let resultData = null;

        const rl = readline.createInterface({ input: proc.stdout });
        rl.on('line', (line) => {
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.type === 'info') {
              resultData = parsed.data;
            } else if (parsed.type === 'error') {
              if (!resolved) {
                resolved = true;
                resolve({ success: false, error_code: parsed.error_code, message: parsed.details });
              }
            }
          } catch (e) {}
        });

        proc.on('close', (code) => {
          if (resolved) return;
          resolved = true;
          if (resultData) {
            resolve({ success: true, data: resultData });
          } else {
            resolve({
              success: false,
              error_code: 'ERR_FETCH_FAILED',
              message: `Failed to fetch video details (exit code ${code})`,
            });
          }
        });

        proc.on('error', (err) => {
          if (resolved) return;
          resolved = true;
          resolve({ success: false, error_code: 'ERR_SPAWN', message: err.message });
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { proc.kill(); } catch (e) {}
            resolve({ success: false, error_code: 'ERR_TIMEOUT', message: 'Metadata resolution timed out.' });
          }
        }, 20000);
      } catch (err) {
        resolve({ success: false, error_code: 'ERR_EXEC', message: err.message });
      }
    });
  };
  ipcMain.handle('fetch-media-info', handleFetchMediaInfo);
  ipcMain.handle('downloader:fetchMediaInfo', handleFetchMediaInfo);

  const handleStartDownload = async (_event, config) => {
    if (!config || !isValidMediaUrl(config.url)) {
      return { success: false, error_code: 'ERR_INVALID_URL', message: 'Invalid YouTube or SoundCloud URL.' };
    }

    const downloadId = config.id || `dl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const engine = resolveEngineCommand();
    const ffmpegDir = resolveFFmpegDirectory();

    const payload = {
      url: config.url.trim(),
      format: config.format || 'mp3',
      quality: config.quality || '320',
      output_dir: config.output_dir || app.getPath('downloads'),
      ffmpeg_path: ffmpegDir,
      embed_thumbnail: config.embed_thumbnail !== false,
      embed_metadata: config.embed_metadata !== false,
      include_id: Boolean(config.include_id),
    };

    const cmdArgs = [...engine.args, 'download', JSON.stringify(payload)];

    try {
      const proc = spawn(engine.executable, cmdArgs, { shell: false });
      activeProcesses.set(downloadId, proc);

      const rl = readline.createInterface({ input: proc.stdout });

      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line.trim());
          if (!mainWindow || mainWindow.isDestroyed()) return;

          if (msg.type === 'progress') {
            mainWindow.webContents.send('download-progress', { id: downloadId, ...msg });
          } else if (msg.type === 'status') {
            mainWindow.webContents.send('download-status', { id: downloadId, ...msg });
          } else if (msg.type === 'complete') {
            mainWindow.webContents.send('download-complete', { id: downloadId, ...msg });
          } else if (msg.type === 'error') {
            mainWindow.webContents.send('download-error', { id: downloadId, ...msg });
          } else if (msg.type === 'aborted') {
            mainWindow.webContents.send('download-aborted', { id: downloadId, ...msg });
          }
        } catch (e) {}
      });

      proc.on('close', () => {
        activeProcesses.delete(downloadId);
      });

      proc.on('error', (err) => {
        activeProcesses.delete(downloadId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-error', {
            id: downloadId,
            error_code: 'ERR_PROC',
            details: err.message,
          });
        }
      });

      return { success: true, downloadId };
    } catch (err) {
      return { success: false, error_code: 'ERR_LAUNCH', message: err.message };
    }
  };
  ipcMain.handle('start-download', handleStartDownload);
  ipcMain.handle('downloader:startDownload', handleStartDownload);

  const handleCancelDownload = async (_event, downloadId) => {
    const proc = activeProcesses.get(downloadId);
    if (!proc) {
      return { success: false, message: 'Download process not found or already finished.' };
    }

    try {
      if (proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.write(JSON.stringify({ action: 'abort' }) + '\n');
      }
      proc.kill('SIGINT');
      setTimeout(() => {
        if (activeProcesses.has(downloadId)) {
          try { proc.kill('SIGKILL'); } catch (e) {}
          activeProcesses.delete(downloadId);
        }
      }, 1500);

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };
  ipcMain.handle('cancel-download', handleCancelDownload);
  ipcMain.handle('downloader:cancelDownload', handleCancelDownload);

  const handleOpenFile = async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return false;

    if (process.platform === 'darwin') {
      return new Promise((resolve) => {
        exec(`open -a "QuickTime Player" "${filePath.replace(/"/g, '\\"')}"`, (err) => {
          if (!err) return resolve(true);
          shell.openPath(filePath).then((res) => resolve(res === ''));
        });
      });
    }

    const res = await shell.openPath(filePath);
    return res === '';
  };
  ipcMain.handle('open-file', handleOpenFile);
  ipcMain.handle('downloader:openFile', handleOpenFile);

  const handleShowInFolder = async (_event, filePath) => {
    if (!filePath) return false;
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    } else {
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        shell.openPath(dir);
        return true;
      }
    }
    return false;
  };
  ipcMain.handle('show-in-folder', handleShowInFolder);
  ipcMain.handle('downloader:showInFolder', handleShowInFolder);

  const handleOpenExternal = async (_event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  };
  ipcMain.handle('open-external', handleOpenExternal);
  ipcMain.handle('downloader:openExternal', handleOpenExternal);

  const handleGetClipboardText = async () => clipboard.readText();
  ipcMain.handle('get-clipboard-text', handleGetClipboardText);
  ipcMain.handle('downloader:getClipboardText', handleGetClipboardText);

  // Window actions
  const handleMinimize = () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  };
  ipcMain.on('window:minimize', handleMinimize);
  ipcMain.on('window-minimize', handleMinimize);

  const handleMaximize = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  };
  ipcMain.on('window:maximize', handleMaximize);
  ipcMain.on('window-maximize', handleMaximize);

  const handleClose = () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  };
  ipcMain.on('window:close', handleClose);
  ipcMain.on('window-close', handleClose);
}
