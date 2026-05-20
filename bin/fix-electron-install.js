#!/usr/bin/env node

const { downloadArtifact } = require('@electron/get')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const { version } = require(path.join(electronDir, 'package.json'))
const distDir = path.resolve(electronDir, 'dist')

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

  const electronPath = path.join(distDir, process.platform === 'win32' ? 'electron.exe' : 'electron')
  if (fs.existsSync(electronPath)) return

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch === 'ia32' ? 'ia32' : 'x64'
  })

  extractZip(zipPath, distDir)
  fs.writeFileSync(path.join(electronDir, 'path.txt'), process.platform === 'win32' ? 'electron.exe' : 'electron')
  fs.writeFileSync(path.join(distDir, 'version'), version.startsWith('v') ? version : `v${version}`)
  console.log(`Electron ${version} installed to ${distDir}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
