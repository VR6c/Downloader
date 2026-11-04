const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  // The installer must be self-contained: refuse to package without the PyInstaller engine for this OS,
  // otherwise users would hit "Failed to fetch video details" and need Python installed.
  if (context.electronPlatformName !== 'darwin') {
    const engineName = context.electronPlatformName === 'win32' ? 'engine.exe' : 'engine';
    const engine = path.join(context.appOutDir, 'resources', 'python-dist', engineName);
    if (!fs.existsSync(engine)) {
      throw new Error(`Missing ${engineName} in ${path.dirname(engine)}. Build it on this OS first: npm run build:engine`);
    }
  }
  if (context.electronPlatformName === 'darwin') {
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    console.log(`\n==> [afterPack] Deep ad-hoc codesigning macOS bundle: ${appPath}`);
    try {
      execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' });
      console.log(`==> [afterPack] Successfully signed ${appPath}\n`);
    } catch (e) {
      console.error(`==> [afterPack] Codesign failed:`, e);
    }
  }
};
