#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const variant = process.argv[2]
if (!variant || !/^(assemble|bundle)[A-Z][A-Za-z]+$/.test(variant)) {
  console.error('Uso: node scripts/native/android-build.mjs assembleDebug|bundleRelease')
  process.exit(2)
}

const root = resolve(import.meta.dirname, '../..')
const android = resolve(root, 'android')
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
if (!existsSync(resolve(android, wrapper))) {
  console.error(`No se encontró ${wrapper}. Ejecuta: pnpm native:setup -- --android`)
  process.exit(1)
}

const result = spawnSync(wrapper, [variant], {
  cwd: android,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
