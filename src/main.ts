import './styles/main.css'
import { Audio } from './engine/audio'
import { I18n, resolveLocale } from './engine/i18n'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore, type SaveData } from './engine/save'
import { stickToWorld } from './game/camera'
import type { Game } from './game/game'
import { bootstrapUrl, Connection } from './net/connection'
import { BUILD, decode, generateRoom, parseEnvelope } from './net/protocol'
import { inviteUrl, loadResume, resolveRoom, socketUrl, storeResume, writeRoom } from './net/session'
import { TouchControls } from './ui/touch'
import { Ui, type NetStatus } from './ui/ui'

/** The own ball is published at 30 Hz, and at most every 16 ms right after a bump or the edge. */
const POSE_INTERVAL_MS = 33
const POSE_URGENT_MS = 16
/** A ping per second measures latency and keeps a quiet room's connection active. */
const PING_INTERVAL_MS = 1000
const MAX_LATENCY_MS = 1000

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const firstRun = safeGet(SAVE_KEY) === null
  const save = new SaveStore()

  const i18n = new I18n(resolveLocale(save.data.locale, navigator.languages))
  const input = new Input(canvas)
  const audio = new Audio()
  let game: Game | undefined
  let room = resolveRoom()
  let status: NetStatus = 'connecting'
  // From Play Online until Leave. The HUD, menu and pause depend on this, not on `welcome`,
  // so connection failures before the first welcome still show their status and an exit.
  let active = false
  let welcomed = false
  let lastSeq = -1
  let poseSeq = 0
  let lastPoseAt = 0
  let lastPingAt = 0
  /** Smoothed one-way latency to the server, in seconds (half the ping round trip). */
  let latency = -1

  const applySettings = (d: SaveData) => {
    audio.setVolumes(d.musicVolume, d.sfxVolume, d.muted)
    if (game) game.reducedMotion = d.reducedMotion
  }

  const connection = new Connection({
    state: state => {
      if (state === 'unavailable') status = 'unavailable'
      else if ((state === 'discovering' || state === 'connecting') && status !== 'reconnecting') status = 'connecting'
    },
    text: text => receive(text),
    lost: code => {
      welcomed = false
      // 4001: this seat was resumed in another tab. Retrying would steal it back.
      if (code === 4001) {
        connection.stop()
        status = 'replaced'
        return
      }
      // 1013: the room already has its maximum number of spectators.
      if (code === 1013) {
        connection.stop()
        status = 'full'
        return
      }
      status = 'reconnecting'
    },
  })

  const reject = (value: NetStatus) => {
    connection.stop()
    welcomed = false
    status = value
  }

  const receive = (text: string) => {
    const g = game
    if (!g) return
    const envelope = parseEnvelope(text)
    if (envelope?.room === room && typeof envelope.marker === 'string' && envelope.marker !== BUILD) {
      reject('update')
      return
    }
    const message = decode(text, room, lastSeq)
    if (!message) return
    if (message.type === 'error') {
      reject('error')
      return
    }
    connection.confirmActivity()
    if (message.type === 'welcome') {
      welcomed = true
      lastSeq = -1
      lastPingAt = 0
      latency = -1
      storeResume(room, connection.endpoint, message.resume_token)
      g.welcome(message)
      status = 'online'
      audio.play('join')
    } else if (!welcomed) {
      return
    } else if (message.type === 'room') {
      lastSeq = message.seq
      g.room(message, performance.now())
    } else if (message.type === 'pose') {
      g.pose(message, Math.max(latency, 0), performance.now())
    } else if (message.type === 'hit') {
      g.hit(message)
    } else if (message.type === 'pong') {
      const sample = (performance.now() - message.t) / 2000
      if (sample >= 0 && sample <= MAX_LATENCY_MS / 1000) latency = latency < 0 ? sample : latency + (sample - latency) * 0.2
    }
  }

  const publish = (nowMs: number) => {
    const g = game
    if (!g || !welcomed) return
    if (nowMs - lastPingAt >= PING_INTERVAL_MS && connection.send(JSON.stringify({ type: 'ping', t: Math.floor(nowMs) }))) lastPingAt = nowMs
    // A contact goes out at once: the other owner applies its half when this arrives.
    for (const hit of g.takeHits()) connection.send(JSON.stringify({ type: 'hit', ...hit }))
    const pose = g.ownPose()
    if (!pose || nowMs - lastPoseAt < (pose.urgent ? POSE_URGENT_MS : POSE_INTERVAL_MS)) return
    const seq = poseSeq + 1
    const lat = Math.min(Math.round(Math.max(latency, 0) * 1000), MAX_LATENCY_MS)
    const { round, x, z, vx, vz } = pose
    if (!connection.send(JSON.stringify({ type: 'pose', seq, round, x, z, vx, vz, lat }))) return
    poseSeq = seq
    lastPoseAt = nowMs
    g.posted()
  }

  const play = (requested: string) => {
    if (!game) return
    room = requested || generateRoom()
    writeRoom(room)
    ui.setRoom(room)
    audio.unlock()
    audio.startMusic()
    welcomed = false
    lastSeq = -1
    status = 'connecting'
    active = true
    ui.show('hud')
    connection.discover(bootstrapUrl(location.href), BUILD, endpoint => socketUrl(endpoint, room, loadResume(room, endpoint)))
  }

  const ui = new Ui(i18n, save, audio, input, {
    play,
    menu: open => {
      if (!active) return
      ui.show(open ? 'menu' : 'hud')
    },
    leave: () => {
      connection.stop()
      active = false
      welcomed = false
      game?.leave()
      ui.show('title')
    },
    invite: () => {
      const url = inviteUrl(room)
      navigator.clipboard?.writeText(url).then(() => ui.copied(), () => window.prompt(i18n.t('hud.invite'), url))
        ?? window.prompt(i18n.t('hud.invite'), url)
    },
    settings: patch => {
      const qualityChanged = patch.quality !== undefined && patch.quality !== save.data.quality
      save.update(patch)
      applySettings(save.data)
      if (patch.locale) i18n.set(patch.locale)
      if (qualityChanged) game?.setQuality(save.data.quality)
    },
  })
  ui.show('boot')
  ui.setRoom(room)
  applySettings(save.data)

  // Boot: the UI above is already on screen; three.js and the game load as a separate chunk
  // behind the progress bar. Preload models/textures here too (engine/assets.ts).
  let loaded = 0
  const track = <T>(p: Promise<T>): Promise<T> => p.then(v => (ui.setBootProgress(0.1 + (++loaded / 3) * 0.9), v))
  ui.setBootProgress(0.1)
  const [{ Game }, { Renderer, suggestQuality }] = await Promise.all([
    track(import('./game/game')),
    track(import('./engine/renderer')),
    track(document.fonts.ready),
  ])
  if (firstRun) {
    save.update({ quality: suggestQuality() })
    ui.refreshSettings()
  }

  const renderer = new Renderer(canvas, save.data.quality)
  game = new Game(renderer, audio, {
    event: kind => {
      if (kind === 'round') ui.go()
    },
  })
  game.reducedMotion = save.data.reducedMotion
  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([
      import('../scripts/manus-tuning/adapter.js'), import('./game/tuning'),
    ])
    await registerGameTuning(tuning)
  }
  const g = game

  const loop = new GameLoop({
    step: dt => g.step(dt),
    render: (_alpha, frameSeconds) => {
      input.update()
      // Pause toggles only between the HUD and the menu; Settings owns its own Back.
      if (input.consume('pause') && active && (ui.screen === 'hud' || ui.screen === 'menu')) ui.show(ui.screen === 'hud' ? 'menu' : 'hud')
      ui.frame(frameSeconds)
      connection.poll(frameSeconds)
      // The menu does not pause the match, but it releases the stick.
      const stick = ui.screen === 'hud' ? stickToWorld(g.side, input.move.x, input.move.y) : { x: 0, z: 0 }
      g.setInput(stick.x, stick.z)
      publish(performance.now())
      g.render(frameSeconds)
      if (active) ui.updateHud({ room, role: g.role, status, state: g.state, phaseSeconds: g.phaseSeconds() })
      input.endFrame()
    },
  })
  loop.start()

  new TouchControls(document.getElementById('ui')!, input, () => active && ui.screen === 'hud')

  window.setTimeout(() => ui.show('title'), 250)
  // Debug/test hook (read-only use): smoke tests inspect match state through it.
  ;(window as unknown as { __game: unknown }).__game = { game: g, ui, input, save, connection }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

boot().catch(err => {
  console.error(err)
  const el = document.getElementById('ui')
  if (el) el.innerHTML = `<div class="fatal">Failed to start: ${String((err as Error)?.message ?? err).replace(/[<>&]/g, '')}</div>`
})
