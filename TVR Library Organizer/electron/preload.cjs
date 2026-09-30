const { contextBridge, ipcRenderer } = require('electron');

/**
 * Unified Preload Bridge for TVR Studio (Tag Editor & Downloader)
 */

// 1. Tag Editor API Bridge (window.api)
const apiBridge = {
  isElectron: true,
  platform: process.platform,

  // Native File Dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Metadata & File Operations
  readAudioMetadata: (filePath) => ipcRenderer.invoke('file:readMetadata', filePath),
  saveAndRenameFile: (params) => ipcRenderer.invoke('file:saveMetadataAndRename', params),
  batchProcessFiles: (batchRequest) => ipcRenderer.invoke('file:batchProcess', batchRequest),
  exportPlaylistFile: (params) => ipcRenderer.invoke('file:exportPlaylist', params),
  getPathForFile: (file) => {
    try {
      const { webUtils } = require('electron');
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (_) {}
    return file?.path || '';
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
};

// 2. Downloader API Bridge (window.tvr)
const downloaderBridge = {
  // App & Environment
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getEngineStatus: () => ipcRenderer.invoke('get-engine-status'),
  updateEngine: () => ipcRenderer.invoke('update-engine'),

  // Directory & Paths
  selectDirectory: (defaultPath) => ipcRenderer.invoke('select-directory', defaultPath),
  getDefaultDownloadDir: () => ipcRenderer.invoke('get-default-download-dir'),

  // Media Operations
  fetchMediaInfo: (url) => ipcRenderer.invoke('fetch-media-info', url),
  startDownload: (config) => ipcRenderer.invoke('start-download', config),
  cancelDownload: (downloadId) => ipcRenderer.invoke('cancel-download', downloadId),

  // Shell & Filesystem
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  getMediaUrl: (filePath) => (filePath ? `media-stream://local/${encodeURIComponent(filePath)}` : ''),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Event Listeners with Cleanup Unsubscribe Callbacks
  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onDownloadStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download-status', handler);
    return () => ipcRenderer.removeListener('download-status', handler);
  },
  onDownloadComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download-complete', handler);
    return () => ipcRenderer.removeListener('download-complete', handler);
  },
  onDownloadError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download-error', handler);
    return () => ipcRenderer.removeListener('download-error', handler);
  },
  onDownloadAborted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download-aborted', handler);
    return () => ipcRenderer.removeListener('download-aborted', handler);
  },
};

// Expose both bridges for clean separation and backwards compatibility
contextBridge.exposeInMainWorld('api', {
  ...apiBridge,
  downloader: downloaderBridge,
});

contextBridge.exposeInMainWorld('tvr', downloaderBridge);
