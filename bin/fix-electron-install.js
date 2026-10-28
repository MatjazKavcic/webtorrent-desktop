#!/usr/bin/env node

const { downloadArtifact } = require('@electron/get')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const { version } = require(path.join(electronDir, 'package.json'))
const distDir = path.resolve(electronDir, 'dist')

function getPlatformPath () {
  switch (process.platform) {
    case 'darwin':
    case 'mas':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'win32':
      return 'electron.exe'
    default:
      return 'electron'
  }
}

function extractZip (zipPath, destDir) {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' }
    )
    return
  }
  const extract = require('extract-zip')
  return extract(zipPath, { dir: destDir })
}

async function main () {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1') return

  const platformPath = getPlatformPath()
  const arch = process.env.npm_config_arch || process.arch
  const pathTxt = path.join(electronDir, 'path.txt')
  const installed = fs.existsSync(path.join(distDir, platformPath)) &&
    fs.existsSync(pathTxt) && fs.readFileSync(pathTxt, 'utf8') === platformPath
  if (installed && !archMismatch(path.join(distDir, platformPath), arch)) return

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch
  })

  await extractZip(zipPath, distDir)
  fs.writeFileSync(pathTxt, platformPath)
  fs.writeFileSync(path.join(distDir, 'version'), version.startsWith('v') ? version : `v${version}`)
  console.log(`Electron ${version} (${arch}) installed to ${distDir}`)
}

// macOS only: detect a binary built for the wrong CPU (e.g. x64 Electron on Apple Silicon)
function archMismatch (binPath, arch) {
  if (process.platform !== 'darwin') return false
  try {
    const out = execSync(`file -b "${binPath}"`, { encoding: 'utf8' })
    return !out.includes(arch === 'x64' ? 'x86_64' : arch)
  } catch (err) {
    return false
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
