const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const readline = require('readline');
const { app, ipcMain, dialog, shell, clipboard } = require('electron');
const { resolveEngineCommand, resolveFFmpegDirectory, isValidMediaUrl } = require('../lib/platform.cjs');
const { runEngineOnce } = require('../lib/engineProcess.cjs');
const { createDownloadRegistry } = require('../lib/downloadRegistry.cjs');

// Active child processes by download ID, for clean cancellation and zombie prevention.
const activeProcesses = new Map();
const cancelRequested = new Set();
// Survives renderer reloads: the UI rebuilds itself from this after a refresh.
const registry = createDownloadRegistry();

function terminateAllProcesses() {
  for (const proc of activeProcesses.values()) {
    try { proc.kill('SIGTERM'); } catch { /* already exited */ }
  }
  activeProcesses.clear();
}

const engineStatusBase = (ffmpegDir) => ({ ffmpeg_available: Boolean(ffmpegDir), ffmpeg_path: ffmpegDir });

function getEngineStatus() {
  const engine = resolveEngineCommand();
  const ffmpegDir = resolveFFmpegDirectory();
  const base = { ...engineStatusBase(ffmpegDir), engine_path: engine.executable };

  return runEngineOnce(engine, ['--version'], {
    timeoutMs: 15000,
    onMessage: (msg) =>
      msg.type === 'init'
        ? {
            ready: true,
            ytdlp_version: msg.ytdlp_version,
            python_version: msg.python_version,
            ffmpeg_available: msg.ffmpeg_available,
            ffmpeg_path: msg.ffmpeg_path || ffmpegDir,
            engine_path: engine.executable,
          }
        : undefined,
    onClose: (code) => ({ ready: code === 0, ytdlp_version: 'available', python_version: 'runtime', ...base }),
    onError: (err) => ({ ready: false, error: err.message, ...base }),
    onTimeout: () => ({ ready: false, error: 'Engine handshake timed out', ...engineStatusBase(ffmpegDir) }),
  });
}

function updateEngine() {
  let lastResult = null;
  return runEngineOnce(resolveEngineCommand(), ['update'], {
    onMessage: (msg) => {
      if (msg.type === 'update' || msg.type === 'error') lastResult = msg;
    },
    onClose: (code) => lastResult || { type: 'update', status: code === 0 ? 'success' : 'error' },
    onError: (err) => ({ type: 'update', status: 'error', message: err.message }),
    onTimeout: () => lastResult,
  });
}

function fetchMediaInfo(rawUrl) {
  if (!isValidMediaUrl(rawUrl)) {
    return { success: false, error_code: 'ERR_INVALID_URL', message: 'Invalid YouTube or SoundCloud URL provided.' };
  }
  const ffmpegDir = resolveFFmpegDirectory();
  const args = ['info', rawUrl.trim(), ...(ffmpegDir ? [ffmpegDir] : [])];
  let info = null;

  return runEngineOnce(resolveEngineCommand(), args, {
    timeoutMs: 20000,
    onMessage: (msg) => {
      if (msg.type === 'info') info = msg.data;
      else if (msg.type === 'error') return { success: false, error_code: msg.error_code, message: msg.details };
    },
    onClose: (code) =>
      info
        ? { success: true, data: info }
        : { success: false, error_code: 'ERR_FETCH_FAILED', message: `Failed to fetch video details (exit code ${code})` },
    onError: (err) => ({ success: false, error_code: 'ERR_SPAWN', message: err.message }),
    onTimeout: () => ({ success: false, error_code: 'ERR_TIMEOUT', message: 'Metadata resolution timed out.' }),
  });
}

const DOWNLOAD_EVENTS = {
  progress: 'download-progress',
  status: 'download-status',
  complete: 'download-complete',
  error: 'download-error',
  aborted: 'download-aborted',
};

function startDownload(config, getWindow) {
  if (!config || !isValidMediaUrl(config.url)) {
    return { success: false, error_code: 'ERR_INVALID_URL', message: 'Invalid YouTube or SoundCloud URL.' };
  }

  const downloadId = config.id || `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const engine = resolveEngineCommand();
  const payload = {
    url: config.url.trim(),
    format: config.format || 'mp3',
    quality: config.quality || '320',
    output_dir: config.output_dir || app.getPath('downloads'),
    ffmpeg_path: resolveFFmpegDirectory(),
    embed_thumbnail: config.embed_thumbnail !== false,
    embed_metadata: config.embed_metadata !== false,
    include_id: Boolean(config.include_id),
    filename: typeof config.filename === 'string' ? config.filename : '',
  };

  const emit = (channel, data) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  try {
    const proc = spawn(engine.executable, [...engine.args, 'download', JSON.stringify(payload)], { shell: false });
    activeProcesses.set(downloadId, proc);
    registry.start(downloadId, {
      url: payload.url,
      format: payload.format,
      title: typeof config.title === 'string' ? config.title : undefined,
      author: typeof config.author === 'string' ? config.author : undefined,
    });

    // If the process ends without a terminal message (crash, kill), tell the UI instead of leaving it waiting
    const reportExit = (details) => {
      const cancelled = cancelRequested.delete(downloadId);
      const result = registry.markExited(
        downloadId,
        cancelled ? { type: 'aborted', details: 'Cancelled by user' } : { details }
      );
      if (result) emit(DOWNLOAD_EVENTS[result.type], result);
    };

    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      try {
        const msg = JSON.parse(line.trim());
        registry.onMessage(downloadId, msg);
        const channel = DOWNLOAD_EVENTS[msg.type];
        if (channel) emit(channel, { id: downloadId, ...msg });
      } catch {
        // non-JSON engine output
      }
    });
    proc.on('close', (code) => {
      activeProcesses.delete(downloadId);
      reportExit(`Download process exited unexpectedly (code ${code}).`);
    });
    proc.on('error', (err) => {
      activeProcesses.delete(downloadId);
      const result = registry.markExited(downloadId, { details: err.message });
      emit('download-error', result || { id: downloadId, error_code: 'ERR_PROC', details: err.message });
    });

    return { success: true, downloadId };
  } catch (err) {
    return { success: false, error_code: 'ERR_LAUNCH', message: err.message };
  }
}

function cancelDownload(downloadId) {
  const proc = activeProcesses.get(downloadId);
  if (!proc) return { success: false, message: 'Download process not found or already finished.' };

  cancelRequested.add(downloadId);
  try {
    if (proc.stdin && !proc.stdin.destroyed) proc.stdin.write(JSON.stringify({ action: 'abort' }) + '\n');
    proc.kill('SIGINT');
    setTimeout(() => {
      if (activeProcesses.has(downloadId)) {
        try { proc.kill('SIGKILL'); } catch { /* already exited */ }
        activeProcesses.delete(downloadId);
      }
    }, 1500);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function openFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  if (process.platform === 'darwin') {
    // execFile (no shell) so file names can never be interpreted as shell syntax.
    const opened = await new Promise((resolve) =>
      execFile('open', ['-a', 'QuickTime Player', filePath], (err) => resolve(!err))
    );
    if (opened) return true;
  }
  return (await shell.openPath(filePath)) === '';
}

function showInFolder(filePath) {
  if (!filePath) return false;
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  const dir = path.dirname(filePath);
  if (fs.existsSync(dir)) {
    shell.openPath(dir);
    return true;
  }
  return false;
}

async function openExternal(url) {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    await shell.openExternal(url);
    return true;
  }
  return false;
}

function registerDownloaderHandlers(getWindow) {
  const getAppInfo = async () => ({
    version: app.getVersion(),
    defaultDownloadDir: app.getPath('downloads'),
    ffmpegDir: resolveFFmpegDirectory(),
    platform: process.platform,
  });

  ipcMain.handle('get-app-info', getAppInfo);
  ipcMain.handle('get-engine-status', getEngineStatus);
  ipcMain.handle('update-engine', updateEngine);
  ipcMain.handle('select-directory', async (_e, defaultPath) => {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: 'Select Destination Folder',
      defaultPath: defaultPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled || !result.filePaths?.length ? null : result.filePaths[0];
  });
  ipcMain.handle('get-default-download-dir', async () => app.getPath('downloads'));
  ipcMain.handle('fetch-media-info', (_e, url) => fetchMediaInfo(url));
  ipcMain.handle('start-download', (_e, config) => startDownload(config, getWindow));
  ipcMain.handle('cancel-download', (_e, id) => cancelDownload(id));
  ipcMain.handle('open-file', (_e, filePath) => openFile(filePath));
  ipcMain.handle('show-in-folder', (_e, filePath) => showInFolder(filePath));
  ipcMain.handle('open-external', (_e, url) => openExternal(url));
  ipcMain.handle('get-clipboard-text', async () => clipboard.readText());
  ipcMain.handle('downloads:snapshot', () => registry.snapshot());
  ipcMain.handle('downloads:ack', (_e, id) => registry.ack(id));
}

module.exports = { registerDownloaderHandlers, terminateAllProcesses };
