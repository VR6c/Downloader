#!/usr/bin/env node
/**
 * Downloads the FFmpeg + FFprobe binaries TVR Studio bundles, into bin/<mac|win|linux>/.
 *
 * They are not committed (they exceed GitHub's 100 MB file limit), so a fresh clone and every CI
 * build run this first:
 *
 *   node scripts/fetch-ffmpeg.cjs                 # for the OS you are on
 *   node scripts/fetch-ffmpeg.cjs --platform=win  # another OS's binaries (cross-packaging)
 *   node scripts/fetch-ffmpeg.cjs --force         # re-download even if already present
 *   node scripts/fetch-ffmpeg.cjs --out=<dir>     # write somewhere else (testing)
 *
 * macOS gets a universal (arm64 + x86_64) binary so one bundle runs on both chips.
 * Sources are static builds, so nothing else needs to be installed on the user's machine.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { execFileSync } = require('child_process');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const hostPlatform = { darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform];
const platform = args.platform || hostPlatform;
const projectRoot = path.join(__dirname, '..');
const outDir = args.out ? path.resolve(args.out) : path.join(projectRoot, 'bin', platform);
const exe = (name) => (platform === 'win' ? `${name}.exe` : name);

const SOURCES = {
  mac: {
    // martin-riedl.de: static release builds, one archive per tool and architecture
    urls: (tool, arch) => `https://ffmpeg.martin-riedl.de/redirect/latest/macos/${arch}/release/${tool}.zip`,
  },
  win: {
    // BtbN GPL build: one archive holding both tools under <folder>/bin/
    archive: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
  },
  linux: {
    // John Van Sickle static build
    archive: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
  },
};

const log = (msg) => console.log(`[fetch-ffmpeg] ${msg}`);

async function download(url, dest) {
  log(`downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
}

// On Windows runners Git Bash's GNU tar can come first on PATH and reads "C:\..." as a remote host, so use the
// built-in bsdtar explicitly.
const tarCommand =
  process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

function extract(archive, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (archive.endsWith('.zip')) {
    // GNU tar on Linux can't read zip; bsdtar (macOS, Windows 10+) can, but unzip is the safe choice where present
    if (process.platform === 'linux') execFileSync('unzip', ['-q', '-o', archive, '-d', dest]);
    else execFileSync(tarCommand, ['-xf', archive, '-C', dest]);
  } else {
    execFileSync(tarCommand, ['-xf', archive, '-C', dest]);
  }
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(full, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

function install(src, name) {
  const dest = path.join(outDir, exe(name));
  fs.copyFileSync(src, dest);
  if (platform !== 'win') fs.chmodSync(dest, 0o755);
  return dest;
}

/** Only meaningful when the binary can run on this machine. */
function runs(file) {
  const runnable = platform === hostPlatform;
  if (!runnable) return null;
  try {
    execFileSync(file, ['-version'], { stdio: 'ignore', timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!SOURCES[platform]) throw new Error(`Unknown platform "${platform}" (use mac, win or linux)`);

  const already = ['ffmpeg', 'ffprobe'].every((t) => fs.existsSync(path.join(outDir, exe(t))));
  if (already && !args.force) {
    log(`already present in ${outDir} (use --force to re-download)`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tvr-ffmpeg-'));

  try {
    if (platform === 'mac') {
      for (const tool of ['ffmpeg', 'ffprobe']) {
        const slices = [];
        for (const arch of ['arm64', 'amd64']) {
          const zip = path.join(tmp, `${tool}-${arch}.zip`);
          const dir = path.join(tmp, `${tool}-${arch}`);
          await download(SOURCES.mac.urls(tool, arch), zip);
          extract(zip, dir);
          slices.push(findFile(dir, tool));
        }
        const out = path.join(outDir, tool);
        // One fat binary so the same bundle runs natively on Apple Silicon and Intel
        execFileSync('lipo', ['-create', ...slices, '-output', out]);
        fs.chmodSync(out, 0o755);
        log(`built universal ${tool}`);
      }
    } else {
      const archive = path.join(tmp, path.basename(SOURCES[platform].archive));
      const dir = path.join(tmp, 'extracted');
      await download(SOURCES[platform].archive, archive);
      extract(archive, dir);
      for (const tool of ['ffmpeg', 'ffprobe']) {
        const found = findFile(dir, exe(tool));
        if (!found) throw new Error(`${exe(tool)} not found inside the downloaded archive`);
        install(found, tool);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  for (const tool of ['ffmpeg', 'ffprobe']) {
    const file = path.join(outDir, exe(tool));
    if (!fs.existsSync(file)) throw new Error(`Missing after install: ${file}`);
    const ok = runs(file);
    log(`${exe(tool)}: ${(fs.statSync(file).size / 1048576).toFixed(0)} MB${ok === null ? '' : ok ? ', runs OK' : ', FAILED TO RUN'}`);
    if (ok === false) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[fetch-ffmpeg] ${err.message}`);
  process.exit(1);
});
