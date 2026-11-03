const { app, ipcMain, net } = require('electron');
const { checkForUpdates } = require('../lib/updates.cjs');
const pkg = require('../../package.json');

function registerUpdateHandlers() {
  // Electron's net.fetch honours the system proxy settings, unlike Node's global fetch
  ipcMain.handle('updates:check', () =>
    checkForUpdates({
      currentVersion: app.getVersion(),
      repository: pkg.repository,
      platform: process.platform,
      arch: process.arch,
      fetchImpl: (url, options) => net.fetch(url, options),
      userAgent: `TVR-Studio/${app.getVersion()}`,
    })
  );
}

module.exports = { registerUpdateHandlers };
