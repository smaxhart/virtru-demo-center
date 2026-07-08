const { execSync } = require('child_process')
const path = require('path')

// Squirrel.Mac requires a valid code signature on install.
// Electron embeds a minimal ad-hoc signature (no resources) which Squirrel rejects.
// Re-sign with --deep --force so the full bundle including resources is covered.
exports.default = async function afterPack({ appOutDir, packager }) {
  if (packager.platform.name !== 'mac') return
  const appPath = path.join(appOutDir, `${packager.appInfo.productName}.app`)
  console.log(`[afterPack] Re-signing ad-hoc with resources: ${appPath}`)
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
    console.log('[afterPack] Ad-hoc re-sign complete')
    execSync(`codesign -dvv "${appPath}"`, { stdio: 'inherit' })
  } catch (e) {
    console.warn('[afterPack] codesign failed:', e.message)
  }
}
