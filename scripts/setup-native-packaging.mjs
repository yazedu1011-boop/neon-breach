#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const args = new Set(process.argv.slice(2))
const install = args.has('--install')
const addAndroid = args.has('--android')
const checkOnly = args.has('--check')

const files = {
  'capacitor.config.ts': `import type { CapacitorConfig } from '@capacitor/cli'\n\nconst config: CapacitorConfig = {\n  appId: 'com.neonbreach.fractureops',\n  appName: 'Neon Breach: Fracture Ops',\n  webDir: 'dist',\n  bundledWebRuntime: false,\n  server: {\n    androidScheme: 'https',\n    cleartext: false,\n  },\n}\n\nexport default config\n`,
  'src-tauri/tauri.conf.json': `{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Neon Breach: Fracture Ops",
  "version": "0.1.0",
  "identifier": "com.neonbreach.fractureops",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Neon Breach: Fracture Ops",
        "width": 1440,
        "height": 900,
        "minWidth": 960,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "windows": {
      "nsis": {
        "installMode": "perUser",
        "displayLanguageSelector": true
      }
    }
  }
}
`,
  'src-tauri/Cargo.toml': `[package]
name = "neonbreach"
version = "0.1.0"
description = "Neon Breach: Fracture Ops"
authors = ["Neon Breach Team"]
edition = "2021"

[lib]
name = "neonbreach_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["custom-protocol"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
`,
  'src-tauri/build.rs': `fn main() { tauri_build::build() }\n`,
  'src-tauri/src/lib.rs': `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\n\n#[tauri::command]\nfn app_version() -> &'static str {\n    "0.1.0"\n}\n\n#[cfg_attr(mobile, tauri::mobile_entry_point)]\npub fn run() {\n    tauri::Builder::default()\n        .invoke_handler(tauri::generate_handler![app_version])\n        .run(tauri::generate_context!())\n        .expect("error while running Neon Breach");\n}\n`,
  'src-tauri/src/main.rs': `fn main() { neonbreach_lib::run() }\n`,
}

function writeProjectFiles() {
  for (const [relative, content] of Object.entries(files)) {
    const target = resolve(root, relative)
    mkdirSync(dirname(target), { recursive: true })
    if (!existsSync(target) || args.has('--force')) writeFileSync(target, content)
  }
  const favicon = resolve(root, 'assets/share/favicon.png')
  const icon = resolve(root, 'src-tauri/icons/icon.png')
  if (existsSync(favicon) && (!existsSync(icon) || args.has('--force'))) copyFileSync(favicon, icon)
  console.log('Configuración Tauri/Capacitor escrita.')
}

function command(name) {
  const result = spawnSync(name, ['--version'], { cwd: root, stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' })
  return result.status === 0 ? (result.stdout || result.stderr).trim().split(/\r?\n/)[0] : null
}

function checkTool(name, hint) {
  const version = command(name)
  console.log(`${version ? 'OK ' : 'NO '} ${name}${version ? ` — ${version}` : ` — ${hint}`}`)
  return Boolean(version)
}

function installDependencies() {
  const commands = [
    ['pnpm', ['add', '-D', '@tauri-apps/cli']],
    ['pnpm', ['add', '@capacitor/core', '@capacitor/android']],
    ['pnpm', ['add', '-D', '@capacitor/cli']],
  ]
  for (const [name, commandArgs] of commands) {
    const result = spawnSync(name, commandArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
}

function addAndroidPlatform() {
  if (existsSync(resolve(root, 'android'))) return console.log('Android ya está inicializado.')
  const result = spawnSync('pnpm', ['exec', 'cap', 'add', 'android'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function enforceLandscape() {
  const manifest = resolve(root, 'android/app/src/main/AndroidManifest.xml')
  if (!existsSync(manifest)) return
  const source = readFileSync(manifest, 'utf8')
  if (source.includes('android:screenOrientation="landscape"')) return
  const patched = source.replace(/(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*)>/, '$1\n            android:screenOrientation="landscape">')
  if (patched !== source) writeFileSync(manifest, patched)
  console.log('Android configurado en orientación landscape.')
}

writeProjectFiles()
if (install) installDependencies()
if (addAndroid) addAndroidPlatform()
if (existsSync(resolve(root, 'android'))) enforceLandscape()
if (checkOnly || args.has('--check-tools')) {
  console.log('\nHerramientas nativas:')
  checkTool('cargo', 'instala Rust desde https://rustup.rs')
  checkTool('rustc', 'instala Rust desde https://rustup.rs')
  checkTool('java', 'instala JDK 17 o superior')
  checkTool('adb', 'instala Android SDK Platform Tools')
  checkTool('gradle', 'Android Studio proporciona el Gradle wrapper del proyecto')
}

console.log(`\nSiguiente paso: pnpm build:native`)
console.log('Windows: pnpm desktop:build')
console.log('Android APK debug: pnpm android:build:debug')
console.log('Android AAB release: pnpm android:build:release')
console.log('XAPK no es un artefacto Android estándar; usa APK/AAB o un empaquetador XAPK externo.')
