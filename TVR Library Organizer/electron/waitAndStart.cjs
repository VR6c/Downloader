const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const electronBin = require('electron');

function checkVite(retries = 0) {
  const req = http.get('http://localhost:5173', (res) => {
    console.log('[Electron Launcher] Vite server ready! Launching Electron window...');
    const electronProcess = spawn(electronBin, [path.join(__dirname, 'main.cjs')], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
    });

    electronProcess.on('close', (code) => {
      process.exit(code || 0);
    });
  });

  req.on('error', (err) => {
    if (retries < 60) {
      setTimeout(() => checkVite(retries + 1), 350);
    } else {
      console.error('[Electron Launcher] Timed out waiting for Vite server.');
      process.exit(1);
    }
  });
}

console.log('[Electron Launcher] Waiting for Vite on http://localhost:5173 ...');
checkVite();
