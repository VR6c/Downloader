const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, protocol, net } = require('electron');
const { registerTagEditorHandlers } = require('./ipc/tagEditor.cjs');
const { registerDownloaderHandlers, terminateAllProcesses } = require('./ipc/downloader.cjs');
const { registerWindowHandlers } = require('./ipc/window.cjs');
const { registerUpdateHandlers } = require('./ipc/updates.cjs');

const DEV_URL = 'http://localhost:5173';
const PROD_INDEX = path.join(__dirname, '../dist/index.html');

// Privileged scheme for streaming local media into <audio>/<video>
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media-stream',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

let mainWindow = null;
const getWindow = () => mainWindow;

function loadRenderer(win) {
  if (app.isPackaged && process.env.NODE_ENV !== 'development') {
    win.loadFile(PROD_INDEX).catch(() => {});
    return;
  }
  win.loadURL(DEV_URL).catch(() => {
    if (win.isDestroyed()) return;
    if (fs.existsSync(PROD_INDEX)) {
      win.loadFile(PROD_INDEX).catch(() => {});
    } else {
      setTimeout(() => !win.isDestroyed() && win.loadURL(DEV_URL).catch(() => {}), 1500);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 480,
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
    const dockIcon = path.join(__dirname, '../public/music.png');
    if (fs.existsSync(dockIcon)) app.dock.setIcon(dockIcon);
  }

  loadRenderer(mainWindow);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerMediaProtocol() {
  protocol.handle('media-stream', (request) => {
    try {
      const raw = request.url.replace(/^media-stream:\/\//, '').replace(/^local\//, '');
      return net.fetch(pathToFileURL(decodeURIComponent(raw)).href);
    } catch {
      return new Response('File not found', { status: 404 });
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerMediaProtocol();
    registerTagEditorHandlers(getWindow);
    registerDownloaderHandlers(getWindow);
    registerWindowHandlers(getWindow);
    registerUpdateHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', terminateAllProcesses);
app.on('window-all-closed', () => {
  terminateAllProcesses();
  if (process.platform !== 'darwin') app.quit();
});
