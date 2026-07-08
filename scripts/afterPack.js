const { execSync } = require('child_process')
const path = require('path')

// Remove the linker-embedded ad-hoc signature so Squirrel.Mac doesn't reject
// the update with "code has no resources but signature indicates they must be present"
exports.default = async function afterPack({ appOutDir, packager }) {
  if (packager.platform.name !== 'mac') return
  const appPath = path.join(appOutDir, `${packager.appInfo.productName}.app`)
  console.log(`[afterPack] Removing ad-hoc signature from ${appPath}`)
  try {
    execSync(`codesign --remove-signature "${appPath}"`, { stdio: 'inherit' })
    // Also remove from the main binary inside
    const bin = path.join(appPath, 'Contents', 'MacOS', packager.appInfo.productName)
    execSync(`codesign --remove-signature "${bin}"`, { stdio: 'inherit' })
    console.log('[afterPack] Signature removed')
  } catch (e) {
    console.warn('[afterPack] Could not remove signature:', e.message)
  }
}
