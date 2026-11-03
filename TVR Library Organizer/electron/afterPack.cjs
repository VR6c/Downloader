const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
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
