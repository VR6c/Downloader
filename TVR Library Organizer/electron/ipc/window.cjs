const { ipcMain } = require('electron');

/** Window controls are exposed under two channel names: `window:*` (window.api) and `window-*` (window.tvr). */
function registerWindowHandlers(getWindow) {
  const withWindow = (fn) => () => {
    const win = getWindow();
    if (win && !win.isDestroyed()) fn(win);
  };

  const actions = {
    minimize: withWindow((win) => win.minimize()),
    maximize: withWindow((win) => (win.isMaximized() ? win.unmaximize() : win.maximize())),
    close: withWindow((win) => win.close()),
  };

  for (const [name, action] of Object.entries(actions)) {
    ipcMain.on(`window:${name}`, action);
    ipcMain.on(`window-${name}`, action);
  }
}

module.exports = { registerWindowHandlers };
