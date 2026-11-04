const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { app, ipcMain, net, shell } = require('electron');
const { checkForUpdates, parseRepo } = require('../lib/updates.cjs');
const pkg = require('../../package.json');

const PROGRESS_INTERVAL_MS = 200;

/** Only installers published on this app's own GitHub releases may be downloaded and run. */
function isTrustedAssetUrl(url) {
  const repo = parseRepo(pkg.repository);
  if (!repo || typeof url !== 'string') return false;
  return url.startsWith(`https://github.com/${repo.owner}/${repo.repo}/releases/download/`);
}

async function downloadInstaller(url, onProgress) {
  const fileName = path.basename(decodeURIComponent(new URL(url).pathname)).replace(/[^\w.\- ()]/g, '_');
  const dest = path.join(app.getPath('downloads'), fileName);

  const res = await net.fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  let lastEmit = 0;
  const source = Readable.fromWeb(res.body);
  source.on('data', (chunk) => {
    received += chunk.length;
    const now = Date.now();
    if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
      lastEmit = now;
      onProgress({ received, total });
    }
  });

  const partial = `${dest}.part`;
  try {
    await pipeline(source, fs.createWriteStream(partial));
    fs.renameSync(partial, dest);
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw err;
  }
  onProgress({ received, total: total || received });
  return dest;
}

/** Hands the downloaded installer to the OS. Unsigned builds can't swap themselves in place, so the installer does it. */
function launchInstaller(file) {
  if (process.platform === 'win32') {
    spawn(file, [], { detached: true, stdio: 'ignore' }).unref();
    // Give the installer a moment to start, then leave so it can replace our files
    setTimeout(() => app.quit(), 800);
    return 'installing';
  }
  if (process.platform === 'darwin') {
    shell.openPath(file); // mounts the .dmg; the user drags TVR Studio into Applications
    return 'opened';
  }
  try { fs.chmodSync(file, 0o755); } catch { /* best effort */ }
  shell.showItemInFolder(file);
  return 'revealed';
}

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

  let installing = false;
  ipcMain.handle('updates:install', async (event, url) => {
    if (!isTrustedAssetUrl(url)) return { success: false, message: 'Untrusted update address.' };
    if (installing) return { success: false, message: 'An update is already downloading.' };
    installing = true;
    try {
      const file = await downloadInstaller(url, (p) => {
        if (!event.sender.isDestroyed()) event.sender.send('updates:progress', p);
      });
      return { success: true, filePath: file, action: launchInstaller(file) };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'The update could not be downloaded.' };
    } finally {
      installing = false;
    }
  });
}

module.exports = { registerUpdateHandlers };
