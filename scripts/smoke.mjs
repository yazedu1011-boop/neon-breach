// Smoke test del vertical slice Android-first: arranque, entrada al campo, loadout, HUD y ajustes.
import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const out = process.env.SHOTS_DIR ?? 'shots'
const port = Number(process.env.SMOKE_PORT ?? 4173)
mkdirSync(out, { recursive: true })
if (!existsSync('dist/index.html')) throw new Error('smoke: ejecuta `pnpm build` primero')

const preview = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' })
let browser
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const tap = (page, selector) => page.evaluate((value) => document.querySelector(value)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), selector)
try {
  await wait(1200)
  const executablePath = existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--ignore-gpu-blocklist'] })
  const errors = []
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  desktop.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  desktop.on('pageerror', error => errors.push(String(error)))
  await desktop.goto(`http://127.0.0.1:${port}/`)
  await desktop.waitForSelector('[data-screen="title"].is-active', { timeout: 15000 })
  await desktop.screenshot({ path: `${out}/01-title-landscape.png` })
  await tap(desktop, '[data-action="play"]')
  await desktop.waitForSelector('[data-screen="hud"].is-active', { timeout: 5000 })
  await desktop.waitForSelector('[data-slot-index="3"]')
  const loadout = await desktop.locator('.loadout-slot').count()
  if (loadout !== 4) throw new Error(`expected four loadout slots, got ${loadout}`)
  await tap(desktop, '[data-slot-index="1"]')
  await desktop.waitForFunction(() => document.querySelector('[data-slot="weapon-name"]')?.textContent?.includes('Escopeta'))
  await desktop.screenshot({ path: `${out}/02-hud-loadout.png` })
  await tap(desktop, '[data-action="menu"]')
  await tap(desktop, '[data-screen="menu"] [data-action="settings"]')
  await desktop.waitForSelector('[data-screen="settings"].is-active')
  await desktop.selectOption('[name="hudProfile"]', 'competitive')
  await desktop.locator('[name="hudScale"]').fill('1.2')
  await desktop.screenshot({ path: `${out}/03-settings-hud.png` })
  await tap(desktop, '[data-action="back"]')
  await tap(desktop, '[data-action="close-menu"]')
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await phone.goto(`http://127.0.0.1:${port}/`)
  await phone.waitForSelector('[data-screen="title"].is-active', { timeout: 15000 })
  await tap(phone, '[data-action="play"]')
  await phone.waitForSelector('[data-screen="hud"].is-active', { timeout: 5000 })
  await phone.screenshot({ path: `${out}/04-phone-hud.png` })
  if (errors.length) throw new Error(`console errors:\n  ${errors.join('\n  ')}`)
  console.log(`smoke: OK — Android HUD, loadout y ajustes; screenshots in ${out}/`)
} catch (error) {
  console.error(`smoke: FAIL — ${error?.message ?? String(error)}`)
  process.exitCode = 1
} finally {
  await browser?.close().catch(() => {})
  preview.kill('SIGTERM')
}
