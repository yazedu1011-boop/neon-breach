import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import type { Audio } from '../engine/audio'
import type { Renderer } from '../engine/renderer'
import type { Quality } from '../engine/save'
import { Arena } from './arena'
import { ArenaCamera } from './camera'
import { Effects } from './fx'

export type GameAudio = { shot?: AudioBuffer; dash?: AudioBuffer; reward?: AudioBuffer }
export type MatchState = 'playing' | 'victory' | 'defeat'
export type GameHud = {
  health: number; shield: number; ammo: number; reserve: number; mode: 'fps' | 'tps'; ability: number; dash: number
  botsLeft: number; kills: number; score: number; message: string; npc: string; fps: number; activeSlot: number
  weaponName: string; weaponSlots: string[]; speedModifier: number; storm: number; aiming: boolean; chestPrompt: string; matchState: MatchState
}
type WeaponSpec = { name: string; short: string; speed: number; magazine: number; fireRate: number; damage: number; spread: number; color: string }
type CharacterRig = { group: THREE.Group; mixer?: THREE.AnimationMixer; idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; limbs?: { arms: THREE.Object3D[]; legs: THREE.Object3D[] } }
type Bot = CharacterRig & { root: THREE.Group; hp: number; maxHp: number; alive: boolean; fire: number; think: number; los: boolean; target: THREE.Vector3; label: string; bar: THREE.Sprite; speed: number }
type Npc = { root: THREE.Group; name: string; dialogue: string[]; index: number }
type Chest = { root: THREE.Group; lid: THREE.Object3D; opened: boolean; openAmount: number; position: THREE.Vector3; tier: string; color: string }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const neon = (color: string, intensity = 1.6) => new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.42, emissive: color, emissiveIntensity: intensity })
const SPAWN = new THREE.Vector3(0, 0, 68)
let barMap: THREE.Texture | undefined
function healthBarTexture(): THREE.Texture {
  if (barMap) return barMap
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 8
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ffffff'; context.beginPath(); context.roundRect(0, 0, 64, 8, 4); context.fill()
  barMap = new THREE.CanvasTexture(canvas); barMap.colorSpace = THREE.SRGBColorSpace; return barMap
}

/** Humanoide articulado de respaldo: nunca una cápsula. */
function createHumanoid(suit: string, accent: string): CharacterRig {
  const group = new THREE.Group()
  const fabric = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.62, metalness: 0.28 })
  const armor = new THREE.MeshStandardMaterial({ color: '#2c3648', roughness: 0.42, metalness: 0.62 })
  const glow = neon(accent, 2.1)
  const skin = new THREE.MeshStandardMaterial({ color: '#c49a82', roughness: 0.8 })
  const part = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh
  }
  part(group, 0.56, 0.2, 0.32, 0, 0.96, 0, fabric)
  part(group, 0.62, 0.62, 0.36, 0, 1.3, 0, armor)
  part(group, 0.5, 0.26, 0.38, 0, 1.48, 0.01, glow)
  part(group, 0.46, 0.5, 0.22, 0, 1.32, -0.26, armor)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin); head.position.y = 1.76; head.castShadow = true; group.add(head)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), armor); helmet.position.y = 1.79; group.add(helmet)
  part(group, 0.34, 0.09, 0.08, 0, 1.76, 0.19, glow)
  const arms: THREE.Object3D[] = []
  const legs: THREE.Object3D[] = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.4, 1.56, 0); group.add(shoulder)
    part(shoulder, 0.17, 0.46, 0.17, 0, -0.23, 0, fabric)
    part(shoulder, 0.15, 0.4, 0.15, 0, -0.62, 0.04, armor)
    part(shoulder, 0.16, 0.14, 0.18, 0, -0.86, 0.06, glow)
    arms.push(shoulder)
    const hip = new THREE.Group(); hip.position.set(side * 0.16, 0.92, 0); group.add(hip)
    part(hip, 0.21, 0.44, 0.22, 0, -0.22, 0, fabric)
    part(hip, 0.19, 0.4, 0.2, 0, -0.62, 0, armor)
    part(hip, 0.22, 0.16, 0.32, 0, -0.86, 0.05, armor)
    legs.push(hip)
  }
  return { group, limbs: { arms, legs } }
}

function tintModel(model: THREE.Object3D, color: string, accent: string): void {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    object.material = Array.isArray(object.material) ? materials.map(material => material.clone()) : materials[0].clone()
    const list = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of list) if (material instanceof THREE.MeshStandardMaterial) { material.color.lerp(new THREE.Color(color), 0.45); material.emissive = new THREE.Color(accent); material.emissiveIntensity = Math.min(0.5, material.emissiveIntensity + 0.08) }
  })
}

export class Game {
  readonly camera = new ArenaCamera()
  readonly arena: Arena
  reducedMotion = false
  private readonly effects = new Effects()
  private readonly ray = new THREE.Raycaster()
  private readonly avatar = new THREE.Group()
  private readonly weapon = new THREE.Group()
  private readonly bots: Bot[] = []
  private readonly npcs: Npc[] = []
  private readonly chests: Chest[] = []
  private readonly tracers: Array<{ line: THREE.Line; life: number }> = []
  private audioBuffers: GameAudio = {}
  private heroPrototype?: THREE.Object3D
  private heroClips: THREE.AnimationClip[] = []
  private playerRig?: CharacterRig
  private playerMixer?: THREE.AnimationMixer
  private playerIdle?: THREE.AnimationAction
  private playerWalk?: THREE.AnimationAction
  private move = { x: 0, y: 0 }
  private inputLook = { x: 0, y: 0 }
  private readonly velocity = new THREE.Vector3()
  private time = 0
  private score = 0
  private kills = 0
  private health = 100
  private shield = 50
  private ammo = 24
  private reserve = 240
  private fireCooldown = 0
  private reloadTimer = 0
  private abilityCooldown = 0
  private dashCooldown = 0
  private message = 'Salta a Fracture Island: abre cofres y sé el último en pie.'
  private npcMessage = 'Busca a Aster Quill en la ciudad vertical.'
  private chestPrompt = ''
  private requestedInteract = false
  private requestedDash = false
  private requestedAbility = false
  private requestedReload = false
  private requestedCamera = false
  private requestedRestart = false
  private started = false
  private fps = 60
  private matchState: MatchState = 'playing'
  private stormRadius = 100
  private stormTimer = 0
  private speedFactor = 1
  private readonly weaponSlots: WeaponSpec[] = [
    { name: 'Rifle Prisma', short: 'ARMA 1', speed: 0.86, magazine: 30, fireRate: 0.11, damage: 16, spread: 0.035, color: '#65f6ff' },
    { name: 'Escopeta Vector', short: 'ARMA 2', speed: 0.7, magazine: 8, fireRate: 0.7, damage: 14, spread: 0.09, color: '#ff3b9d' },
    { name: 'Pistola Cero', short: 'PISTOLA', speed: 0.94, magazine: 14, fireRate: 0.22, damage: 22, spread: 0.03, color: '#ffcc66' },
    { name: 'Puño', short: 'PUÑO', speed: 1.08, magazine: 1, fireRate: 0.45, damage: 34, spread: 0, color: '#8cffb0' },
  ]
  private activeSlot = 0
  private crouchBlend = 0
  private stormMesh: THREE.Mesh
  private verticalVelocity = 0
  private grounded = true

  constructor(private readonly renderer: Renderer, private readonly audio: Audio) {
    this.arena = new Arena(renderer.shadowMapSize)
    this.arena.scene.add(this.effects.mesh)
    this.createAvatar()
    this.createWeapon()
    this.createBots()
    this.createChests()
    this.createNpcs()
    const storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#ff3b9d', transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false }))
    storm.position.y = 30; this.stormMesh = storm; this.arena.addDynamic(storm)
  }
  get scene(): THREE.Scene { return this.arena.scene }
  setAudioBuffers(buffers: GameAudio): void { this.audioBuffers = buffers }
  setHeroModel(model: THREE.Object3D | undefined, clips: THREE.AnimationClip[] = []): void {
    if (!model) return
    this.heroPrototype = model; this.heroClips = clips
    this.applyCharacterModel()
  }
  start(): void { this.started = true; this.matchState = 'playing'; this.message = 'Abre cofres, elimina a los 12 rivales y sobrevive a la tormenta.'; this.avatar.visible = true; this.applyCharacterModel(); this.avatar.position.copy(SPAWN); this.camera.yaw = Math.PI; this.camera.pitch = -0.12 }
  leave(): void { this.started = false; this.score = 0; this.kills = 0; this.avatar.position.copy(SPAWN); this.message = 'Sesión local cerrada.' }
  restart(): void { this.matchState = 'playing'; this.health = 100; this.shield = 50; this.ammo = this.weaponSlots[this.activeSlot].magazine; this.reserve = 240; this.stormRadius = 100; this.stormTimer = 0; this.kills = 0; this.avatar.position.copy(SPAWN); this.camera.yaw = Math.PI; this.velocity.set(0, 0, 0); this.bots.forEach((bot, index) => this.respawnBot(bot, index)); this.chests.forEach(chest => { chest.opened = false; chest.openAmount = 0; chest.lid.rotation.x = 0 }); this.message = 'Nueva partida: 12 rivales en Fracture Island.' }
  setQuality(quality: Quality): void { this.renderer.applyQuality(quality) }
  setInput(x: number, y: number, lookX = 0, lookY = 0): void { this.move.x = x; this.move.y = y; this.inputLook = { x: lookX, y: lookY } }
  request(action: 'interact' | 'dash' | 'ability' | 'reload' | 'camera' | 'restart' | 'jump'): void {
    if (action === 'interact') this.requestedInteract = true; if (action === 'dash') this.requestedDash = true; if (action === 'ability') this.requestedAbility = true
    if (action === 'reload') this.requestedReload = true; if (action === 'camera') this.requestedCamera = true; if (action === 'restart') this.requestedRestart = true
    if (action === 'jump' && this.grounded && this.matchState === 'playing') { this.verticalVelocity = 5.2; this.grounded = false }
  }
  selectSlot(slot: number): void {
    const next = clamp(Math.round(slot), 0, this.weaponSlots.length - 1)
    if (next === this.activeSlot) return
    this.activeSlot = next; this.fireCooldown = 0.16
    const spec = this.weaponSlots[next]
    this.ammo = Math.min(spec.magazine, Math.max(1, this.ammo))
    this.weapon.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.color.set(spec.color) })
    this.message = `${spec.short}: ${spec.name} · peso ${Math.round(spec.speed * 100)}%`
  }
  setFire(held: boolean): void { if (held) this.shootIfReady(false) }
  getHud(): GameHud {
    const spec = this.weaponSlots[this.activeSlot]
    return { health: this.health, shield: this.shield, ammo: this.ammo, reserve: this.reserve, mode: this.camera.mode, ability: this.abilityCooldown, dash: this.dashCooldown, botsLeft: this.bots.filter(bot => bot.alive).length, kills: this.kills, score: this.score, message: this.message, npc: this.npcMessage, fps: this.fps, activeSlot: this.activeSlot, weaponName: spec.name, weaponSlots: this.weaponSlots.map(item => item.short), speedModifier: this.speedFactor, storm: this.stormRadius / 100, aiming: this.camera.aiming, chestPrompt: this.chestPrompt, matchState: this.matchState }
  }

  step(dt: number, fireHeld = false, sprint = false, crouch = false, aiming = false): void {
    const before = performance.now(); this.time += dt; this.fps += ((1 / Math.max(dt, 0.001)) - this.fps) * 0.08
    this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.reloadTimer = Math.max(0, this.reloadTimer - dt); this.abilityCooldown = Math.max(0, this.abilityCooldown - dt); this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.camera.yaw -= this.inputLook.x; this.camera.pitch = clamp(this.camera.pitch - this.inputLook.y, -1.15, 0.9); this.inputLook = { x: 0, y: 0 }
    const ads = aiming && this.started && this.matchState === 'playing'
    this.camera.aiming = ads
    if (this.requestedCamera) { this.camera.toggle(); this.message = this.camera.mode === 'fps' ? 'Primera persona.' : 'Tercera persona táctica.'; this.requestedCamera = false }
    if (this.requestedRestart) { this.restart(); this.requestedRestart = false }
    const forward = new THREE.Vector3(Math.sin(this.camera.yaw), 0, Math.cos(this.camera.yaw)); const right = new THREE.Vector3(forward.z, 0, -forward.x)
    const direction = right.multiplyScalar(this.move.x).add(forward.multiplyScalar(this.move.y)); if (direction.lengthSq() > 1) direction.normalize()
    const targetCrouch = crouch ? 1 : 0; this.crouchBlend += (targetCrouch - this.crouchBlend) * Math.min(1, dt * 12)
    const firing = fireHeld && this.ammo > 0 && this.reloadTimer <= 0
    const base = crouch ? 2.6 : (sprint && !ads && !firing ? 8.6 : 5.4)
    const factor = this.weaponSlots[this.activeSlot].speed * (ads ? 0.28 : (firing ? 0.5 : 1)) * (crouch ? 0.7 : 1)
    this.speedFactor = factor
    const wanted = direction.clone().multiplyScalar(base * factor)
    const accel = direction.lengthSq() > 0.01 ? 14 : 18
    this.velocity.lerp(wanted, Math.min(1, dt * accel))
    if (this.matchState === 'playing') { this.avatar.position.addScaledVector(this.velocity, dt); this.resolveCollisions(this.avatar.position); this.avatar.position.x = clamp(this.avatar.position.x, -this.arena.bounds + 2, this.arena.bounds - 2); this.avatar.position.z = clamp(this.avatar.position.z, -this.arena.bounds + 2, this.arena.bounds - 2) }
    if (!this.grounded) { this.verticalVelocity -= 14 * dt; this.avatar.position.y += this.verticalVelocity * dt; if (this.avatar.position.y <= 0) { this.avatar.position.y = 0; this.verticalVelocity = 0; this.grounded = true } }
    this.avatar.scale.y = 1 - this.crouchBlend * 0.18
    this.updateStorm(dt)
    if (this.requestedDash) { this.doDash(direction); this.requestedDash = false }
    if (this.requestedAbility) { this.doAbility(); this.requestedAbility = false }
    if (this.requestedReload) { this.reload(); this.requestedReload = false }
    if (fireHeld) this.shootIfReady(ads)
    if (this.reloadTimer === 0 && this.ammo === 0 && this.reserve > 0) this.reload()
    this.updateBots(dt)
    this.updateChests(dt)
    const moving = this.velocity.lengthSq() > 0.4
    this.animatePlayer(moving, dt)
    this.interactIfRequested()
    this.updateTracers(dt); this.effects.update(dt)
    this.camera.update(this.avatar.position, dt, this.reducedMotion)
    this.avatar.visible = this.started && this.camera.mode === 'tps'
    this.weapon.visible = this.started && this.camera.mode === 'fps'
    if (this.playerRig && !this.heroPrototype) this.playerRig.group.rotation.y = this.camera.yaw + Math.PI
    this.updateChestPrompt()
    if (this.started && this.matchState === 'playing' && this.bots.every(bot => !bot.alive)) { this.matchState = 'victory'; this.message = '¡VICTORIA DE FRACTURA! Último en pie.'; this.score += 500; this.playBuffer(this.audioBuffers.reward) }
    const elapsed = performance.now() - before; if (elapsed > 10) this.fps = Math.min(this.fps, 120)
  }
  render(frameSeconds: number): void { this.renderer.render(this.arena.scene, this.camera.camera); for (const t of this.tracers) t.line.visible = t.life > 0; void frameSeconds }

  private createAvatar(): void {
    this.avatar.position.copy(SPAWN); this.arena.addDynamic(this.avatar); this.applyCharacterModel()
    const rim = new THREE.PointLight('#cfeaff', 16, 6.5, 2); rim.position.set(0, 2.6, 1.4); this.avatar.add(rim)
    const fill = new THREE.PointLight('#ffd9b0', 6, 4.5, 2); fill.position.set(0, 1.1, -1.1); this.avatar.add(fill)
  }
  private createWeapon(): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.82), new THREE.MeshStandardMaterial({ color: '#1c2638', metalness: 0.65, roughness: 0.28 })); body.position.set(0.34, -0.25, -0.7); this.weapon.add(body)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.6, 12), neon('#65f6ff', 2.7)); barrel.rotation.x = Math.PI / 2; barrel.position.set(0.34, -0.2, -1.18); this.weapon.add(barrel)
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.22), neon('#ffcc66', 2.1)); sight.position.set(0.34, -0.11, -0.83); this.weapon.add(sight)
    this.camera.camera.add(this.weapon)
  }
  private buildRig(suit: string | null, accent: string): CharacterRig {
    if (this.heroPrototype) {
      const group = new THREE.Group(); const model = cloneSkeleton(this.heroPrototype)
      model.scale.setScalar(1.45); if (suit) tintModel(model, suit, accent); group.add(model)
      group.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true } })
      const rig: CharacterRig = { group }
      if (this.heroClips.length) {
        rig.mixer = new THREE.AnimationMixer(model)
        const idleClip = this.heroClips.find(clip => clip.name.toLowerCase().includes('idle')) ?? this.heroClips[0]
        const walkClip = this.heroClips.find(clip => clip.name.toLowerCase().includes('walk'))
        rig.idle = rig.mixer.clipAction(idleClip); rig.idle.play()
        if (walkClip) rig.walk = rig.mixer.clipAction(walkClip)
      }
      return rig
    }
    return createHumanoid(suit ?? '#33405a', accent)
  }
  private applyCharacterModel(): void {
    this.avatar.children.slice().forEach(child => this.avatar.remove(child))
    const rig = this.buildRig(null, '#65f6ff'); this.avatar.add(rig.group); this.playerRig = rig
    this.playerMixer = rig.mixer; this.playerIdle = rig.idle; this.playerWalk = rig.walk
    for (const bot of this.bots) { bot.root.children.slice().forEach(child => bot.root.remove(child)); const botRig = this.buildRig('#4a2430', '#ff3b9d'); bot.root.add(botRig.group); bot.mixer = botRig.mixer; bot.idle = botRig.idle; bot.walk = botRig.walk; bot.limbs = botRig.limbs }
    for (const npc of this.npcs) { npc.root.children.filter(child => child.userData.npcVisual).forEach(child => npc.root.remove(child)); const npcRig = this.buildRig('#5a4a2a', '#ffcc66'); npcRig.group.userData.npcVisual = true; npc.root.add(npcRig.group) }
  }
  private animatePlayer(moving: boolean, dt: number): void {
    if (this.playerWalk && this.playerIdle) {
      if (moving && !this.playerWalk.isRunning()) { this.playerIdle.fadeOut(0.18); this.playerWalk.reset().fadeIn(0.18).play() }
      else if (!moving && !this.playerIdle.isRunning()) { this.playerWalk.fadeOut(0.18); this.playerIdle.reset().fadeIn(0.18).play() }
    }
    this.playerMixer?.update(dt)
    if (this.playerRig?.limbs && !this.heroPrototype) {
      const swing = moving ? Math.sin(this.time * 9) * 0.55 : 0
      this.playerRig.limbs.legs[0].rotation.x = swing; this.playerRig.limbs.legs[1].rotation.x = -swing
      this.playerRig.limbs.arms[0].rotation.x = -swing * 0.7; this.playerRig.limbs.arms[1].rotation.x = swing * 0.7
    }
  }
  private createBots(): void {
    for (let index = 0; index < 12; index += 1) {
      const root = new THREE.Group(); this.arena.addDynamic(root)
      const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: healthBarTexture(), color: '#ff3b9d', depthTest: true, transparent: true, opacity: 0.95 })); bar.scale.set(0.8, 0.1, 1); bar.position.y = 2.3; bar.visible = false; root.add(bar)
      const rig = this.buildRig('#4a2430', '#ff3b9d'); root.add(rig.group)
      const bot: Bot = { root, hp: 100, maxHp: 100, alive: true, fire: 0, think: 0, los: false, target: new THREE.Vector3(), label: `RIVAL-${String(index + 1).padStart(2, '0')}`, bar, speed: 3.4 + Math.random(), mixer: rig.mixer, idle: rig.idle, walk: rig.walk, limbs: rig.limbs, group: rig.group }
      this.bots.push(bot); this.respawnBot(bot, index)
    }
  }
  private respawnBot(bot: Bot, index: number): void {
    const angle = (index / 12) * Math.PI * 2 + Math.random() * 0.3; const radius = 30 + Math.random() * 62
    bot.root.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    bot.hp = bot.maxHp; bot.alive = true; bot.root.visible = true; bot.bar.scale.set(0.8, 0.1, 1); bot.bar.visible = false; bot.target.copy(bot.root.position); bot.fire = 1 + Math.random()
  }
  private createChests(): void {
    const tiers = [['normal', '#ffcc66'], ['peligroso', '#ff3b9d'], ['evento', '#65f6ff']]
    this.arena.chestSpots.slice(0, 24).forEach((spot, index) => {
      const [tier, color] = tiers[index % tiers.length]
      const root = new THREE.Group(); root.position.copy(spot)
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.62), new THREE.MeshStandardMaterial({ color: '#2a3346', metalness: 0.6, roughness: 0.35 })); body.position.y = 0.28; body.castShadow = true; root.add(body)
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.67), neon(color, 1.8)); trim.position.y = 0.5; root.add(trim)
      const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.56, -0.31); root.add(lidPivot)
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.16, 0.64), new THREE.MeshStandardMaterial({ color: '#39455c', metalness: 0.65, roughness: 0.3 })); lid.position.set(0, 0.05, 0.31); lid.castShadow = true; lidPivot.add(lid)
      this.arena.addDynamic(root)
      this.chests.push({ root, lid: lidPivot, opened: false, openAmount: 0, position: spot.clone(), tier, color })
    })
  }
  private createNpcs(): void {
    const data: Array<[string, [number, number], string[]]> = [
      ['Aster Quill', [-48, -38], ['Nyx es mi hermana. Orin desapareció en el complejo orbital y dejó un rastro de señales.', 'Los cofres de zona peligrosa brillan en magenta. Más riesgo, mejor botín.', 'Si ves a alguien atravesando paredes, repórtalo. Aquí se juega limpio.']],
      ['Mako Ren', [42, -40], ['Aster me enseñó a reparar grúas antes que a disparar. Cada tornillo cuenta.', 'En el puerto hay cofres entre contenedores. Nunca entres solo.', 'La tormenta no perdona. Mantén el escudo alto y elige bien tus rotaciones.']],
      ['Eco de Orin', [60, 58], ['...Nyx, si oyes esto, no vengas sola. La Fractura no es lo que parece.', 'Dejé suministros en el cañón. Úsalos bien.', 'No confíes en la voz que repite tu nombre en la tormenta.']],
    ]
    data.forEach(([name, [x, z], dialogue]) => {
      const root = new THREE.Group(); root.position.set(x, 0, z)
      const rig = this.buildRig('#5a4a2a', '#ffcc66'); rig.group.userData.npcVisual = true; root.add(rig.group)
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 32), neon('#ffcc66', 2)); halo.rotation.x = Math.PI / 2; halo.position.y = 2.2; halo.userData.npcVisual = true; root.add(halo)
      root.userData.npc = name; this.arena.addDynamic(root); this.npcs.push({ root, name, dialogue, index: 0 })
    })
  }
  private updateStorm(dt: number): void {
    if (!this.started || this.matchState !== 'playing') return
    this.stormTimer += dt
    this.stormRadius = Math.max(22, 100 - this.stormTimer * 0.12)
    this.stormMesh.scale.set(this.stormRadius, 1, this.stormRadius)
    const distance = Math.hypot(this.avatar.position.x, this.avatar.position.z)
    if (distance > this.stormRadius) this.damagePlayer(3.5 * dt)
  }
  private updateBots(dt: number): void {
    const player = this.avatar.position
    for (const bot of this.bots) {
      if (!bot.alive) continue
      bot.think -= dt; bot.fire -= dt
      const toPlayer = new THREE.Vector3().subVectors(player, bot.root.position); const distance = toPlayer.length()
      if (bot.think <= 0) {
        bot.think = 0.4 + Math.random() * 0.4
        bot.los = distance < 46 && !this.blocked(bot.root.position, player)
        if (!bot.los && Math.random() < 0.3) bot.target.set(bot.root.position.x + (Math.random() - 0.5) * 40, 0, bot.root.position.z + (Math.random() - 0.5) * 40)
      }
      let moving = false
      if (bot.los && distance < 46) {
        const desired = distance > 14 ? 1 : (distance < 8 ? -1 : 0)
        if (desired !== 0) { bot.root.position.addScaledVector(toPlayer.normalize(), desired * bot.speed * 0.55 * dt); moving = true }
        bot.group.rotation.y = Math.atan2(player.x - bot.root.position.x, player.z - bot.root.position.z)
        if (bot.fire <= 0) { bot.fire = 0.55 + Math.random() * 0.5; this.botShoot(bot, distance) }
      } else {
        const direction = new THREE.Vector3().subVectors(bot.target, bot.root.position); direction.y = 0
        if (direction.length() > 1.2) { bot.root.position.addScaledVector(direction.normalize(), bot.speed * dt); bot.group.rotation.y = Math.atan2(direction.x, direction.z); moving = true }
      }
      bot.root.position.x = clamp(bot.root.position.x, -this.arena.bounds + 3, this.arena.bounds - 3); bot.root.position.z = clamp(bot.root.position.z, -this.arena.bounds + 3, this.arena.bounds - 3)
      if (bot.walk && bot.idle) { if (moving && !bot.walk.isRunning()) { bot.idle.fadeOut(0.2); bot.walk.reset().fadeIn(0.2).play() } else if (!moving && !bot.idle.isRunning()) { bot.walk.fadeOut(0.2); bot.idle.reset().fadeIn(0.2).play() } }
      bot.mixer?.update(dt)
      if (bot.limbs && !this.heroPrototype) { const swing = moving ? Math.sin(this.time * 9 + bot.root.position.x) * 0.55 : 0; bot.limbs.legs[0].rotation.x = swing; bot.limbs.legs[1].rotation.x = -swing; bot.limbs.arms[0].rotation.x = -swing * 0.7; bot.limbs.arms[1].rotation.x = swing * 0.7 }
    }
  }
  private blocked(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const direction = new THREE.Vector3().subVectors(to, from); const length = direction.length(); if (length < 1) return false
    this.ray.set(new THREE.Vector3(from.x, 1.5, from.z), direction.normalize()); this.ray.far = length - 0.6
    return this.ray.intersectObject(this.arena.world, true).length > 0
  }
  private botShoot(bot: Bot, distance: number): void {
    const origin = bot.root.position.clone().setY(1.5)
    const end = this.avatar.position.clone().setY(1.3)
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]); const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ff3b9d', transparent: true, opacity: 0.75 }))
    this.arena.scene.add(line); this.tracers.push({ line, life: 0.07 })
    const chance = clamp(0.62 - distance * 0.008, 0.18, 0.62)
    if (Math.random() < chance) { this.damagePlayer(4 + Math.random() * 3); this.effects.burst(end, '#ff3b9d', 6, 2); this.camera.addShake(0.08) }
  }
  private damagePlayer(amount: number): void {
    if (this.matchState !== 'playing') return
    const shieldDamage = Math.min(this.shield, amount); this.shield -= shieldDamage; this.health = Math.max(0, this.health - (amount - shieldDamage))
    if (this.health <= 0) { this.matchState = 'defeat'; this.message = 'Has caído. Puedes reiniciar la partida.'; this.velocity.set(0, 0, 0) }
  }
  private shootIfReady(ads: boolean): void {
    const spec = this.weaponSlots[this.activeSlot]
    if (!this.started || this.matchState !== 'playing' || this.reloadTimer > 0 || this.fireCooldown > 0) return
    if (this.ammo <= 0) { this.reload(); return }
    this.ammo -= 1; this.fireCooldown = spec.fireRate; this.camera.addRecoil(ads ? 0.02 : 0.045); this.camera.addShake(ads ? 0.05 : 0.12); this.playBuffer(this.audioBuffers.shot)
    const origin = this.camera.camera.position.clone()
    const direction = new THREE.Vector3(); this.camera.camera.getWorldDirection(direction)
    const spread = ads ? spec.spread * 0.18 : spec.spread
    direction.x += (Math.random() - 0.5) * spread; direction.y += (Math.random() - 0.5) * spread; direction.normalize()
    this.ray.set(origin, direction); this.ray.far = 140
    const targets = this.bots.filter(bot => bot.alive).map(bot => bot.root)
    const hits = this.ray.intersectObjects([...targets, this.arena.world], true)
    const hit = hits[0]
    const end = hit ? hit.point.clone() : origin.clone().addScaledVector(direction, 120)
    const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(direction, 1.2), end]), new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.85 }))
    this.arena.scene.add(tracer); this.tracers.push({ line: tracer, life: 0.07 })
    if (!hit) return
    let node: THREE.Object3D | null = hit.object
    while (node && !this.bots.some(bot => bot.root === node)) node = node.parent
    if (!node) { this.effects.burst(hit.point, '#9fb6d0', 4, 2); return }
    const bot = this.bots.find(item => item.root === node)!
    bot.hp -= spec.damage; bot.bar.visible = bot.hp > 0; bot.bar.scale.x = 0.8 * Math.max(0, bot.hp / bot.maxHp)
    this.effects.burst(hit.point, bot.hp <= 0 ? '#ffcc66' : '#65f6ff', bot.hp <= 0 ? 26 : 8, 3)
    if (bot.hp <= 0) { bot.alive = false; bot.root.visible = false; this.kills += 1; this.score += 150; this.message = `${bot.label} eliminado · quedan ${this.bots.filter(item => item.alive).length}`; this.playBuffer(this.audioBuffers.reward) }
    else this.message = `${bot.label} impactado · ${Math.round(bot.hp)}%`
  }
  private updateChests(dt: number): void {
    for (const chest of this.chests) { if (chest.opened && chest.openAmount < 1) { chest.openAmount = Math.min(1, chest.openAmount + dt * 3); chest.lid.rotation.x = -1.2 * chest.openAmount } }
  }
  private updateChestPrompt(): void {
    const nearest = this.chests.filter(chest => !chest.opened).map(chest => ({ chest, distance: chest.position.distanceTo(this.avatar.position) })).sort((a, b) => a.distance - b.distance)[0]
    this.chestPrompt = nearest && nearest.distance < 3.2 ? `Cofre ${nearest.chest.tier} · ABRIR` : ''
  }
  private reload(): void { const capacity = this.weaponSlots[this.activeSlot].magazine; if (this.reloadTimer > 0 || this.ammo >= capacity || this.reserve <= 0) return; this.reloadTimer = this.activeSlot === 1 ? 1.35 : 1.05; window.setTimeout(() => { const need = capacity - this.ammo; const take = Math.min(need, this.reserve); this.ammo += take; this.reserve -= take; this.message = 'Cargador listo.' }, this.reloadTimer * 1000 + 40) }
  private doDash(direction: THREE.Vector3): void {
    if (!this.started || this.dashCooldown > 0) return
    const dir = direction.lengthSq() > 0.01 ? direction.normalize() : new THREE.Vector3(Math.sin(this.camera.yaw), 0, Math.cos(this.camera.yaw))
    this.avatar.position.addScaledVector(dir, 4.5); this.resolveCollisions(this.avatar.position)
    this.dashCooldown = 5; this.camera.addShake(0.18); this.effects.ring(this.avatar.position.clone().setY(0.7), '#65f6ff'); this.playBuffer(this.audioBuffers.dash); this.message = 'CORTE DE FASE ejecutado.'
  }
  private doAbility(): void {
    if (!this.started || this.abilityCooldown > 0) return
    this.abilityCooldown = 8; this.effects.ring(this.avatar.position.clone().setY(1.3), '#ff3b9d')
    this.bots.forEach(bot => { if (bot.alive && bot.root.position.distanceTo(this.avatar.position) < 24) { bot.bar.visible = true; bot.bar.scale.set(1.1, 0.14, 1) } })
    this.message = 'PRISMA DE RASTREO: rivales cercanos marcados.'; this.playBuffer(this.audioBuffers.dash)
  }
  private interactIfRequested(): void {
    if (!this.requestedInteract) return
    this.requestedInteract = false
    const npc = this.npcs.find(item => item.root.position.distanceTo(this.avatar.position) < 3.6)
    if (npc) { this.npcMessage = `${npc.name}: ${npc.dialogue[npc.index % npc.dialogue.length]}`; npc.index += 1; this.message = `Conversación con ${npc.name}.`; return }
    const chest = this.chests.filter(item => !item.opened).map(item => ({ item, distance: item.position.distanceTo(this.avatar.position) })).sort((a, b) => a.distance - b.distance)[0]
    if (!chest || chest.distance > 3.2) { this.message = 'No hay cofre ni NPC en alcance.'; return }
    const target = chest.item; target.opened = true
    const rarity = this.rollRarity(); this.score += 60
    if (this.shield < 100) this.shield = Math.min(100, this.shield + 25); else this.reserve += 60
    this.effects.burst(target.position.clone().setY(0.8), target.color, 22, 3); this.effects.ring(target.position.clone().setY(0.4), target.color)
    this.npcMessage = `Cofre ${target.tier} abierto · ${rarity}. Escudo y munición recuperados.`
    this.message = `Botín ${rarity} obtenido.`; this.playBuffer(this.audioBuffers.reward)
  }
  private rollRarity(): string { const weights = [['Común', 70], ['Poco común', 40], ['Rara', 30], ['Legendaria', 10], ['Mística', 5], ['Especial', 1]] as [string, number][]; const total = weights.reduce((sum, [, weight]) => sum + weight, 0); let value = Math.random() * total; for (const [name, weight] of weights) { value -= weight; if (value <= 0) return name } return 'Común' }
  private resolveCollisions(position: THREE.Vector3): void {
    const radius = 0.45
    for (const collider of this.arena.colliders) {
      const closestX = clamp(position.x, collider.minX, collider.maxX); const closestZ = clamp(position.z, collider.minZ, collider.maxZ)
      const dx = position.x - closestX; const dz = position.z - closestZ; const distanceSq = dx * dx + dz * dz
      if (distanceSq >= radius * radius) continue
      if (distanceSq > 1e-6) { const distance = Math.sqrt(distanceSq); position.x = closestX + (dx / distance) * radius; position.z = closestZ + (dz / distance) * radius }
      else { const pushX = Math.min(position.x - collider.minX, collider.maxX - position.x); const pushZ = Math.min(position.z - collider.minZ, collider.maxZ - position.z); if (pushX < pushZ) position.x += (position.x < (collider.minX + collider.maxX) / 2 ? -1 : 1) * (pushX + radius); else position.z += (position.z < (collider.minZ + collider.maxZ) / 2 ? -1 : 1) * (pushZ + radius) }
    }
  }
  private updateTracers(dt: number): void { for (let i = this.tracers.length - 1; i >= 0; i -= 1) { const tracer = this.tracers[i]; tracer.life -= dt; if (tracer.life <= 0) { tracer.line.geometry.dispose(); (tracer.line.material as THREE.Material).dispose(); this.arena.scene.remove(tracer.line); this.tracers.splice(i, 1) } } }
  private playBuffer(buffer?: AudioBuffer): void { if (buffer) this.audio.playBuffer(buffer, 'sfx') }
}
