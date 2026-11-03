const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const isWin = process.platform === 'win32';
const platformDir = process.platform === 'darwin' ? 'mac' : isWin ? 'win' : 'linux';
const projectRoot = path.join(__dirname, '..', '..');

/** chmod +x on POSIX; failures are non-fatal (read-only volumes, already executable). */
function makeExecutable(filePath) {
  if (isWin) return;
  try {
    if (fs.existsSync(filePath)) fs.chmodSync(filePath, 0o755);
  } catch {
    // ignore
  }
}

function resolveEngineCommand() {
  const binaryName = isWin ? 'engine.exe' : 'engine';

  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, 'python-dist', binaryName),
      path.join(process.resourcesPath, 'bin', platformDir, binaryName),
      path.join(process.resourcesPath, 'bin', binaryName),
      path.join(process.resourcesPath, 'bin', 'engine', binaryName),
    ];
    const found = candidates.find((c) => fs.existsSync(c));
    if (found) {
      makeExecutable(found);
      return { executable: found, args: [], isBinary: true };
    }
  }

  // Development: prefer the local virtualenv for instant startup.
  const engineScript = path.join(projectRoot, 'python', 'engine.py');
  const venvPython = isWin
    ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(projectRoot, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython) && fs.existsSync(engineScript)) {
    return { executable: venvPython, args: [engineScript], isBinary: false };
  }

  // PyInstaller output. Unpackaged only: spawning from inside an .asar fails with ENOTDIR.
  if (!app.isPackaged) {
    const localBin = path.join(projectRoot, 'python-dist', binaryName);
    if (fs.existsSync(localBin)) {
      makeExecutable(localBin);
      return { executable: localBin, args: [], isBinary: true };
    }
  }

  return { executable: isWin ? 'python' : 'python3', args: [engineScript], isBinary: false };
}

function isFFmpegDirectoryRunnable(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') return false;
  const ff = path.join(dirPath, isWin ? 'ffmpeg.exe' : 'ffmpeg');
  if (!fs.existsSync(ff)) return false;
  try {
    const { spawnSync } = require('child_process');
    return spawnSync(ff, ['-version'], { timeout: 2000, stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

/** Returns the first directory containing a runnable ffmpeg, or null. */
function resolveFFmpegDirectory() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'bin', platformDir),
      path.join(process.resourcesPath, 'bin')
    );
  }
  candidates.push(path.join(projectRoot, 'bin', platformDir), path.join(projectRoot, 'bin'));
  const bundledCount = candidates.length;
  candidates.push('/usr/local/bin', '/opt/homebrew/bin'); // system installs: never chmod

  for (const [i, dir] of candidates.entries()) {
    if (!fs.existsSync(dir)) continue;
    if (i < bundledCount) {
      makeExecutable(path.join(dir, 'ffmpeg'));
      makeExecutable(path.join(dir, 'ffprobe'));
    }
    if (isFFmpegDirectoryRunnable(dir)) return dir;
  }
  return null;
}

/** Strict validation for YouTube and SoundCloud URLs. */
function isValidMediaUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  return /^(https?:\/\/)?(www\.|m\.|music\.|on\.)?(youtube\.com|youtu\.be|soundcloud\.com)\/.+$/i.test(url.trim());
}

module.exports = { isWin, platformDir, projectRoot, resolveEngineCommand, resolveFFmpegDirectory, isValidMediaUrl };
