import './styles/main.css'
import type { AnimationClip, Object3D } from 'three'
import { Audio } from './engine/audio'
import { Assets } from './engine/assets'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore, type SaveData } from './engine/save'
import { Renderer } from './engine/renderer'
import { Game } from './game/game'
import { TouchControls } from './ui/touch'
import { Ui } from './ui/ui'

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const save = new SaveStore()
  const input = new Input(canvas)
  const audio = new Audio()
  const assets = new Assets()
  const ui = new Ui(audio, save, input, { play: () => start(), menu: open => { if (active) ui.show(open ? 'menu' : 'hud') }, leave: () => leave(), settings: patch => applySettings(patch), touch: (action, down) => input.setTouchButton(action, down), camera: () => game?.request('camera'), dash: () => game?.request('dash'), ability: () => game?.request('ability'), interact: () => game?.request('interact') })
  let active = false
  let musicStarted = false
  let renderAccumulator = 0
  let hero: Object3D | undefined
  let heroAnimations: AnimationClip[] = []
  let game: Game | undefined
  ui.setBootProgress(0.08)
  const audioPaths = { shot: '/manus-storage/game/sha256/921ff51256f2584de013c5e11ea98df525e130def2712d985f64186e296ae88a.mp3', dash: '/manus-storage/game/sha256/7d0d8c1bbe52eebfdfa102f4fe7d60bcf1214320b26f9fb3d04e661320604fe3.mp3', reward: '/manus-storage/game/sha256/164abbf802873fd25d57d59bfe286b8e962a1427d4ea7380cee76314f9f0566c.mp3', music: '/manus-storage/game/sha256/0affad052e2c220d7cb99e7244cfc94bbe97de223ce4dddbbf127eb7c30fd499.mp3' }
  const localAudioPaths = { shot: '/assets/audio/plasma-shot.mp3', dash: '/assets/audio/dash.mp3', reward: '/assets/audio/reward.mp3', music: '/assets/audio/lobby-theme.mp3' }
  const [loadedAudio, loadedHero] = await Promise.all([
    Promise.all(Object.entries(audioPaths).map(async ([key, path]) => { try { return [key, await audio.load(path)] as const } catch { try { return [key, await audio.load(localAudioPaths[key as keyof typeof localAudioPaths])] as const } catch { return [key, undefined] as const } } })),
    assets.gltf('/manus-storage/game/sha256/0d4597f90d5af0e134bf7e9825e6dd9bcfd0a5957bb56e85203299d7d992c914.glb').catch(() => assets.gltf('/assets/models/nyx-vale-animated.glb').catch(() => undefined)),
  ])
  hero = loadedHero?.scene
  heroAnimations = loadedHero?.animations ?? []
  ui.setBootProgress(0.62)
  if (safeGet(SAVE_KEY) === null) { save.update({ quality: 'low', fpsLimit: 30, autoOptimization: true }); ui.refreshSettings() }
  const renderer = new Renderer(canvas, save.data.quality)
  game = new Game(renderer, audio); game.reducedMotion = save.data.reducedMotion; game.setHeroModel(hero, heroAnimations)
  const buffers: Record<string, AudioBuffer> = {}; for (const [key, buffer] of loadedAudio) if (buffer) buffers[key] = buffer
  game.setAudioBuffers({ shot: buffers.shot, dash: buffers.dash, reward: buffers.reward })
  ui.setBootProgress(1)
  const start = () => { if (!game) return; active = true; audio.unlock(); if (!musicStarted) { if (buffers.music) audio.playBuffer(buffers.music, 'music', true); else audio.startMusic(); musicStarted = true } game.start(); ui.show('hud'); input.lockPointer() }
  const leave = () => { active = false; input.unlockPointer(); game?.leave(); ui.show('title') }
  const applySettings = (patch: Partial<SaveData>) => { const next = { ...patch }; if (patch.devicePreset && save.data.autoOptimization) { if (patch.devicePreset === 'android') Object.assign(next, { quality: 'low' as const, fpsLimit: 30 as const }); if (patch.devicePreset === 'pc') Object.assign(next, { quality: 'medium' as const, fpsLimit: 60 as const }); if (patch.devicePreset === 'joystick') Object.assign(next, { quality: 'medium' as const, fpsLimit: 60 as const }) } save.update(next); audio.setVolumes(save.data.musicVolume, save.data.sfxVolume, save.data.muted); if (game && next.quality) game.setQuality(save.data.quality); game && (game.reducedMotion = save.data.reducedMotion); ui.refreshSettings() }
  const loop = new GameLoop({ step: dt => { input.update(); if (active && game) { const look = input.takeLook(); game.setInput(input.move.x, input.move.y, look.x, look.y); if (input.consume('toggleCamera')) game.request('camera'); if (input.consume('dash')) game.request('dash'); if (input.consume('ability')) game.request('ability'); if (input.consume('interact')) game.request('interact'); if (input.consume('reload')) game.request('reload'); game.step(dt, input.held('fire'), input.held('sprint')) } }, render: (_alpha, frameSeconds) => { renderAccumulator += frameSeconds; const renderStep = 1 / Math.max(30, save.data.fpsLimit); if (game && renderAccumulator >= renderStep) { game.render(frameSeconds); renderAccumulator = 0 } ui.frame(frameSeconds); if (active && game) ui.updateHud(game.getHud()); input.endFrame() } })
  loop.start(); new TouchControls(document.getElementById('ui')!, input, () => active && ui.screen === 'hud'); window.setTimeout(() => ui.show('title'), 700)
  ;(window as unknown as { __game: unknown }).__game = { game, ui, input, save }
}
function safeGet(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
boot().catch(err => { console.error(err); const el = document.getElementById('ui'); if (el) el.innerHTML = `<div class="fatal">No se pudo iniciar el campo de pruebas: ${String((err as Error)?.message ?? err).replace(/[<>&]/g, '')}</div>` })
