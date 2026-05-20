#!/usr/bin/env node

/**
 * Replaces Electron's FFmpeg with a proprietary-codec build from
 * https://github.com/nwjs-ffmpeg-prebuilt/nwjs-ffmpeg-prebuilt
 *
 * Skip with: INSTALL_CODEC_PACK=0 npm install
 */

const fs = require('fs')
const https = require('https')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const pkg = require(path.join(ROOT, 'package.json'))

const RELEASE_BASE =
  'https://github.com/nwjs-ffmpeg-prebuilt/nwjs-ffmpeg-prebuilt/releases/download'

// Electron major -> nwjs-ffmpeg-prebuilt tag (NW.js version with matching Chromium)
const ELECTRON_FFMPEG_TAG = {
  27: '0.81.0',
  39: '0.105.0'
}

function resolveTag (electronVersion) {
  const codecPack = pkg.codecPack || {}
  const electronMajor = Number(electronVersion.split('.')[0])
  return codecPack.nwjsFfmpegVersion || ELECTRON_FFMPEG_TAG[electronMajor]
}

function main () {
  const codecPack = pkg.codecPack || {}

  if (process.env.INSTALL_CODEC_PACK === '0' || codecPack.enabled === false) {
    console.log('Codec pack: skipped (disabled)')
    return
  }

  const electronVersion = require(path.join(ROOT, 'node_modules/electron/package.json')).version
  const tag = resolveTag(electronVersion)

  if (!tag) {
    console.warn(
      `Codec pack: no nwjs-ffmpeg mapping for Electron ${electronVersion}. ` +
      'Set package.json codecPack.nwjsFfmpegVersion or add to bin/install-codec-pack.js.'
    )
    return
  }

  const distDir = path.join(ROOT, 'node_modules', 'electron', 'dist')
  if (!fs.existsSync(distDir)) {
    console.warn('Codec pack: electron dist not found (run npm install first)')
    return
  }

  installCodecPack(distDir, tag, electronVersion)
    .catch(err => {
      console.error('Codec pack: install failed:', err.message)
      process.exitCode = 1
    })
}

function installCodecPack (distDir, tag, electronVersion) {
  const platformKey = getPlatformKey()
  if (!platformKey) {
    console.warn(`Codec pack: unsupported platform ${process.platform}/${process.arch}`)
    return
  }

  const zipName = `${tag}-${platformKey}.zip`
  const url = `${RELEASE_BASE}/${tag}/${zipName}`
  const cacheDir = path.join(ROOT, 'build', 'codec-pack')
  const zipPath = path.join(cacheDir, zipName)

  fs.mkdirSync(cacheDir, { recursive: true })

  console.log(`Codec pack: installing ${tag} (${platformKey}) for Electron ${electronVersion}...`)

  const cachedExtract = path.join(cacheDir, 'extract')
  const cachedFfmpeg = findFfmpegDir(cachedExtract)
  if (cachedFfmpeg) {
    applyFfmpeg(distDir, cachedFfmpeg, platformKey)
    console.log('Codec pack: installed proprietary FFmpeg (cached)')
    return Promise.resolve()
  }

  const extractDir = path.resolve(cacheDir, 'extract')
  fs.rmSync(extractDir, { recursive: true, force: true })
  fs.mkdirSync(extractDir, { recursive: true })

  return download(url, zipPath)
    .then(() => extractZip(zipPath, extractDir))
    .then(() => {
      const ffmpegDir = findFfmpegDir(extractDir)
      if (!ffmpegDir) throw new Error('ffmpeg binary not found in downloaded archive')
      applyFfmpeg(distDir, ffmpegDir, platformKey)
      console.log('Codec pack: installed proprietary FFmpeg')
    })
}

function findFfmpegDir (dir) {
  if (!fs.existsSync(dir)) return null
  if (process.platform === 'win32' && fs.existsSync(path.join(dir, 'ffmpeg.dll'))) return dir
  if (process.platform === 'darwin' && fs.existsSync(path.join(dir, 'libffmpeg.dylib'))) return dir
  if (process.platform === 'linux') {
    for (const name of ['libffmpeg.so', 'libffmpeg.so.6']) {
      if (fs.existsSync(path.join(dir, name))) return dir
    }
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findFfmpegDir(path.join(dir, entry.name))
      if (found) return found
    }
  }
  return null
}

function installCodecPackForElectronApp (appDir, electronVersion) {
  const tag = resolveTag(electronVersion)
  if (!tag) return Promise.resolve()
  return installCodecPack(appDir, tag, electronVersion)
}

function getPlatformKey () {
  if (process.platform === 'win32') {
    return process.arch === 'ia32' ? 'win-ia32' : 'win-x64'
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'osx-arm64' : 'osx-x64'
  }
  if (process.platform === 'linux') {
    return process.arch === 'ia32' ? 'linux-ia32' : 'linux-x64'
  }
  return null
}

function download (url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const request = (location) => {
      https.get(location, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          request(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${location}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
      }).on('error', reject)
    }
    request(url)
  })
}

function extractZip (zipPath, destDir) {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' }
    )
    return
  }
  execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' })
}

function applyFfmpeg (distDir, extractedDir, platformKey) {
  if (platformKey.startsWith('win')) {
    const src = path.join(extractedDir, 'ffmpeg.dll')
    const dest = path.join(distDir, 'ffmpeg.dll')
    backupAndCopy(src, dest)
    return
  }

  if (platformKey.startsWith('osx')) {
    const src = path.join(extractedDir, 'libffmpeg.dylib')
    const frameworkLib = path.join(
      distDir,
      'Electron.app',
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Libraries',
      'libffmpeg.dylib'
    )
    if (fs.existsSync(frameworkLib)) {
      backupAndCopy(src, frameworkLib)
    } else if (fs.existsSync(src)) {
      backupAndCopy(src, path.join(distDir, 'libffmpeg.dylib'))
    }
    return
  }

  if (platformKey.startsWith('linux')) {
    const candidates = ['libffmpeg.so', 'libffmpeg.so.6', 'ffmpeg.so']
    for (const name of candidates) {
      const src = path.join(extractedDir, name)
      if (fs.existsSync(src)) {
        backupAndCopy(src, path.join(distDir, name))
        return
      }
    }
  }
}

function backupAndCopy (src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Codec pack binary missing: ${src}`)
  }
  const backup = dest + '.stock'
  if (!fs.existsSync(backup) && fs.existsSync(dest)) {
    fs.copyFileSync(dest, backup)
  }
  try {
    fs.copyFileSync(src, dest)
  } catch (err) {
    if (err.code === 'EBUSY') {
      throw new Error(
        `Cannot replace ${path.basename(dest)} (file in use). Quit WebTorrent/Electron and run: npm run install-codec-pack`
      )
    }
    throw err
  }
}

if (require.main === module) {
  main()
} else {
  module.exports = {
    installCodecPack,
    installCodecPackForElectronApp,
    getPlatformKey
  }
}
