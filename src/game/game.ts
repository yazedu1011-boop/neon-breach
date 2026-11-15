import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Renderer } from '../engine/renderer'
import type { Quality } from '../engine/save'
import { Arena } from './arena'
import { ArenaCamera } from './camera'
import { Effects } from './fx'

export type GameAudio = { shot?: AudioBuffer; dash?: AudioBuffer; reward?: AudioBuffer }
export type GameHud = { health: number; shield: number; ammo: number; reserve: number; mode: 'fps' | 'tps'; ability: number; dash: number; targetCount: number; score: number; message: string; npc: string; fps: number; activeSlot: number; weaponName: string; weaponSlots: string[]; speedModifier: number; storm: number }
type Target = { root: THREE.Group; hp: number; maxHp: number; respawn: number; label: string }
type Npc = { root: THREE.Group; name: string; dialogue: string[]; index: number }
type WeaponSpec = { name: string; short: string; speed: number; magazine: number; fireRate: number; color: string }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const neon = (color: string, intensity = 1.6) => new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.42, emissive: color, emissiveIntensity: intensity })

export class Game {
  readonly camera = new ArenaCamera()
  readonly arena: Arena
  reducedMotion = false
  private readonly effects = new Effects()
  private readonly ray = new THREE.Raycaster()
  private readonly avatar = new THREE.Group()
  private readonly weapon = new THREE.Group()
  private readonly targets: Target[] = []
  private readonly npcs: Npc[] = []
  private readonly tracers: Array<{ line: THREE.Line; life: number }> = []
  private audioBuffers: GameAudio = {}
  private move = { x: 0, y: 0 }
  private time = 0
  private score = 0
  private health = 100
  private shield = 50
  private ammo = 24
  private reserve = 144
  private fireCooldown = 0
  private reloadTimer = 0
  private abilityCooldown = 0
  private dashCooldown = 0
  private message = 'Campo de tiro listo. Lee el ángulo y controla el ritmo.'
  private npcMessage = 'Acércate a Aster para conocer la historia de Nyx.'
  private requestedInteract = false
  private requestedDash = false
  private requestedAbility = false
  private requestedReload = false
  private requestedCamera = false
  private inputLook = { x: 0, y: 0 }
  private started = false
  private fps = 60
  private heroModel?: THREE.Object3D
  private heroMixer?: THREE.AnimationMixer
  private heroIdle?: THREE.AnimationAction
  private heroWalk?: THREE.AnimationAction
  private readonly weaponSlots: WeaponSpec[] = [
    { name: 'Rifle Prisma', short: 'ARMA 1', speed: 0.86, magazine: 24, fireRate: 0.12, color: '#65f6ff' },
    { name: 'Escopeta Vector', short: 'ARMA 2', speed: 0.72, magazine: 8, fireRate: 0.62, color: '#ff3b9d' },
    { name: 'Pistola Cero', short: 'PISTOLA', speed: 0.94, magazine: 12, fireRate: 0.24, color: '#ffcc66' },
    { name: 'Puño', short: 'PUÑO', speed: 1.08, magazine: 1, fireRate: 0.5, color: '#8cffb0' },
  ]
  private activeSlot = 0
  private crouchBlend = 0
  private storm = 100

  constructor(private readonly renderer: Renderer, private readonly audio: Audio) {
    this.arena = new Arena(renderer.shadowMapSize)
    this.arena.scene.add(this.effects.mesh)
    this.createAvatar()
    this.createWeapon()
    this.createTargets()
    this.createNpcs()
  }
  get scene(): THREE.Scene { return this.arena.scene }
  setAudioBuffers(buffers: GameAudio): void { this.audioBuffers = buffers }
  setHeroModel(model: THREE.Object3D | undefined, clips: THREE.AnimationClip[] = []): void {
    if (!model) return
    this.heroModel = model.clone(true); this.heroModel.scale.setScalar(1.45); this.heroModel.position.y = 0; this.avatar.add(this.heroModel); this.avatar.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
    if (clips.length > 0) {
      this.heroMixer = new THREE.AnimationMixer(this.heroModel)
      const idleClip = clips.find(clip => clip.name.toLowerCase().includes('idle')) ?? clips[0]
      const walkClip = clips.find(clip => clip.name.toLowerCase().includes('walk'))
      this.heroIdle = this.heroMixer.clipAction(idleClip); this.heroIdle.play()
      if (walkClip) this.heroWalk = this.heroMixer.clipAction(walkClip)
    }
  }
  start(): void { this.started = true; this.message = 'Objetivo activo: elimina los dummies y habla con Aster.'; this.avatar.visible = true }
  leave(): void { this.started = false; this.camera.mode = 'fps'; this.score = 0; this.avatar.position.set(0, 0, 0); this.message = 'Sesión local cerrada.' }
  setQuality(quality: Quality): void { this.renderer.applyQuality(quality) }
  setInput(x: number, y: number, lookX = 0, lookY = 0): void { this.move.x = x; this.move.y = y; this.inputLook = { x: lookX, y: lookY } }
  request(action: 'interact' | 'dash' | 'ability' | 'reload' | 'camera'): void { if (action === 'interact') this.requestedInteract = true; if (action === 'dash') this.requestedDash = true; if (action === 'ability') this.requestedAbility = true; if (action === 'reload') this.requestedReload = true; if (action === 'camera') this.requestedCamera = true }
  selectSlot(slot: number): void {
    const next = Math.max(0, Math.min(this.weaponSlots.length - 1, Math.round(slot)))
    if (next === this.activeSlot) return
    this.activeSlot = next
    this.ammo = Math.min(this.weaponSlots[next].magazine, this.ammo)
    this.fireCooldown = 0.14
    const spec = this.weaponSlots[next]
    this.weapon.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.color.set(spec.color) })
    this.message = `${spec.short}: ${spec.name} equipada · velocidad ${Math.round(spec.speed * 100)}%`
  }
  setFire(held: boolean): void { if (held) this.shootIfReady() }
  getHud(): GameHud { const spec = this.weaponSlots[this.activeSlot]; return { health: this.health, shield: this.shield, ammo: this.ammo, reserve: this.reserve, mode: this.camera.mode, ability: this.abilityCooldown, dash: this.dashCooldown, targetCount: this.targets.filter(t => t.hp > 0).length, score: this.score, message: this.message, npc: this.npcMessage, fps: this.fps, activeSlot: this.activeSlot, weaponName: spec.name, weaponSlots: this.weaponSlots.map(item => item.short), speedModifier: spec.speed, storm: this.storm } }

  step(dt: number, fireHeld = false, sprint = false, crouch = false): void {
    const before = performance.now(); this.time += dt; this.fps += ((1 / Math.max(dt, 0.001)) - this.fps) * 0.08
    this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.reloadTimer = Math.max(0, this.reloadTimer - dt); this.abilityCooldown = Math.max(0, this.abilityCooldown - dt); this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.camera.yaw -= this.inputLook.x; this.camera.pitch = clamp(this.camera.pitch - this.inputLook.y, -1.15, 0.9); this.inputLook = { x: 0, y: 0 }
    if (this.requestedCamera) { this.camera.toggle(); this.message = this.camera.mode === 'fps' ? 'Cámara en primera persona.' : 'Cámara táctica en tercera persona.'; this.requestedCamera = false }
    const forward = new THREE.Vector3(Math.sin(this.camera.yaw), 0, Math.cos(this.camera.yaw)); const right = new THREE.Vector3(forward.z, 0, -forward.x)
    const direction = right.multiplyScalar(this.move.x).add(forward.multiplyScalar(this.move.y)); if (direction.lengthSq() > 1) direction.normalize()
    const targetCrouch = crouch ? 1 : 0; this.crouchBlend += (targetCrouch - this.crouchBlend) * Math.min(1, dt * 12)
    const baseSpeed = crouch ? 2.8 : (sprint ? 8.4 : 5.2); const speed = baseSpeed * this.weaponSlots[this.activeSlot].speed; this.avatar.position.addScaledVector(direction, speed * dt); this.avatar.position.x = clamp(this.avatar.position.x, -22, 22); this.avatar.position.z = clamp(this.avatar.position.z, -22, 22); this.avatar.scale.y = 1 - this.crouchBlend * 0.18
    this.storm = Math.max(0, this.storm - dt * 0.012)
    if (this.requestedDash) { this.doDash(direction); this.requestedDash = false }
    if (this.requestedAbility) { this.doAbility(); this.requestedAbility = false }
    if (this.requestedReload) { this.reload(); this.requestedReload = false }
    if (fireHeld) this.shootIfReady()
    if (this.reloadTimer === 0 && this.ammo === 0 && this.reserve > 0) this.reload()
    this.targets.forEach(t => { if (t.hp <= 0) { t.respawn -= dt; t.root.visible = false; if (t.respawn <= 0) { t.hp = t.maxHp; t.root.visible = true; this.message = 'Nuevo dummy desplegado.' } } else { t.root.rotation.y += dt * 0.6 } })
    const moving = direction.lengthSq() > 0.02
    if (this.heroWalk && this.heroIdle) { if (moving && !this.heroWalk.isRunning()) { this.heroIdle.fadeOut(0.18); this.heroWalk.reset().fadeIn(0.18).play() } else if (!moving && !this.heroIdle.isRunning()) { this.heroWalk.fadeOut(0.18); this.heroIdle.reset().fadeIn(0.18).play() } }
    this.heroMixer?.update(dt); this.interactIfRequested(); this.updateTracers(dt); this.effects.update(dt); this.camera.update(this.avatar.position, dt, this.reducedMotion); this.avatar.visible = this.started && this.camera.mode === 'tps'; this.weapon.visible = this.started && this.camera.mode === 'fps'
    if (this.heroModel) this.heroModel.rotation.y = this.camera.yaw + Math.PI
    const elapsed = performance.now() - before; if (elapsed > 8) this.fps = Math.min(this.fps, 120)
  }
  render(frameSeconds: number): void { this.renderer.render(this.arena.scene, this.camera.camera); for (const t of this.tracers) t.line.visible = t.life > 0; void frameSeconds }

  private createAvatar(): void {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.92, 5, 12), new THREE.MeshStandardMaterial({ color: '#2b3444', roughness: 0.58, metalness: 0.35 })); body.position.y = 1.0; body.castShadow = true; this.avatar.add(body)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.32), neon('#65f6ff', 2.3)); visor.position.set(0, 1.48, 0.24); this.avatar.add(visor)
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.38), new THREE.MeshStandardMaterial({ color: '#394b67', metalness: 0.55, roughness: 0.35 })); shoulder.position.y = 1.25; this.avatar.add(shoulder)
    this.avatar.position.set(0, 0, 0); this.arena.addDynamic(this.avatar)
  }
  private createWeapon(): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.82), new THREE.MeshStandardMaterial({ color: '#1c2638', metalness: 0.65, roughness: 0.28 })); body.position.set(0.34, -0.25, -0.7); this.weapon.add(body)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.6, 12), neon('#65f6ff', 2.7)); barrel.rotation.x = Math.PI / 2; barrel.position.set(0.34, -0.2, -1.18); this.weapon.add(barrel)
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.22), neon('#ffcc66', 2.1)); sight.position.set(0.34, -0.11, -0.83); this.weapon.add(sight)
    this.camera.camera.add(this.weapon)
  }
  private createTargets(): void {
    const spots = [[-7, -4], [-2, -8], [6, -4], [10, 4], [-10, 7], [3, 10]] as [number, number][]
    spots.forEach(([x, z], i) => { const root = new THREE.Group(); root.position.set(x, 0, z); const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 1.1, 8), new THREE.MeshStandardMaterial({ color: '#263348', metalness: 0.4, roughness: 0.5 })); stand.position.y = 0.55; root.add(stand); const core = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.16, 24), neon(i % 2 ? '#ff3b9d' : '#65f6ff', 2.2)); core.rotation.x = Math.PI / 2; core.position.y = 1.65; root.add(core); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.035, 8, 32), neon('#ffcc66', 1.5)); ring.position.y = 1.65; ring.rotation.x = Math.PI / 2; root.add(ring); root.userData.target = true; this.arena.addDynamic(root); this.targets.push({ root, hp: 100, maxHp: 100, respawn: 0, label: `DUMMY-${String(i + 1).padStart(2, '0')}` }) })
  }
  private createNpcs(): void {
    const data: Array<[string, [number, number], string[]]> = [
      ['Aster Quill', [-13, 2], ['Nyx y yo crecimos entre antenas y tormentas. Ella aprendió a leer el peligro antes de que apareciera.', 'Orin no desapareció: dejó una señal en la Fractura. Si la sigues, no vayas sola.', 'La arena no premia la fuerza bruta. Premia el ángulo que nadie está mirando.']],
      ['Mako Rell', [13, 12], ['Aster me salvó de una compuerta que se cerraba. Desde entonces, arreglo su equipo sin cobrarle.', 'Las cajas ámbar contienen material de práctica. Lo que encuentres aquí no se transfiere a partidas ranked.', 'Si ves una anomalía, repórtala. Una alerta falsa se revisa; un exploit se corrige.']],
    ]
    data.forEach(([name, [x, z], dialogue]) => { const root = new THREE.Group(); root.position.set(x, 0, z); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.85, 4, 10), new THREE.MeshStandardMaterial({ color: '#554a6e', roughness: 0.7 })); body.position.y = 0.9; root.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), neon('#ffcc66', 1.1)); head.position.y = 1.55; root.add(head); const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 32), neon('#ffcc66', 2)); halo.rotation.x = Math.PI / 2; halo.position.y = 2.15; root.add(halo); root.userData.npc = name; this.arena.addDynamic(root); this.npcs.push({ root, name, dialogue, index: 0 }) })
  }
  private shootIfReady(): void {
    const spec = this.weaponSlots[this.activeSlot]
    if (!this.started || this.reloadTimer > 0 || this.fireCooldown > 0) return
    if (this.ammo <= 0) { this.reload(); return }
    this.ammo -= 1; this.fireCooldown = spec.fireRate; this.camera.addRecoil(); this.camera.addShake(0.14); this.playBuffer(this.audioBuffers.shot)
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera.camera); const hits = this.ray.intersectObjects(this.targets.flatMap(t => [t.root]), true); const hit = hits.find(h => h.object.parent?.userData.target || h.object.userData.target)
    const end = hit?.point ?? this.ray.ray.origin.clone().add(this.ray.ray.direction.clone().multiplyScalar(45)); const tracerGeo = new THREE.BufferGeometry().setFromPoints([this.camera.camera.position.clone(), end]); const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: '#65f6ff', transparent: true, opacity: 0.8 })); this.arena.scene.add(tracer); this.tracers.push({ line: tracer, life: 0.075 })
    if (hit) { let root = hit.object; while (root.parent && !root.userData.target) root = root.parent; const target = this.targets.find(t => t.root === root); if (target) { target.hp -= 25; this.effects.burst(hit.point, target.hp <= 0 ? '#ffcc66' : '#65f6ff', target.hp <= 0 ? 28 : 9, 4); if (target.hp <= 0) { target.respawn = 4; this.score += 100; this.message = `${target.label} neutralizado · +100 XP`; this.playBuffer(this.audioBuffers.reward) } else this.message = `${target.label} impactado · ${Math.max(0, target.hp)}%` } }
  }
  private reload(): void { const capacity = this.weaponSlots[this.activeSlot].magazine; if (this.reloadTimer > 0 || this.ammo >= capacity || this.reserve <= 0) return; this.reloadTimer = this.activeSlot === 1 ? 1.35 : 1.05; window.setTimeout(() => { const need = capacity - this.ammo; const take = Math.min(need, this.reserve); this.ammo += take; this.reserve -= take; this.message = 'Cargador listo.' }, this.reloadTimer * 1000 + 40) }
  private doDash(direction: THREE.Vector3): void { if (!this.started || this.dashCooldown > 0) return; const dir = direction.lengthSq() > 0.01 ? direction.normalize() : new THREE.Vector3(Math.sin(this.camera.yaw), 0, Math.cos(this.camera.yaw)); this.avatar.position.addScaledVector(dir, 4.5); this.avatar.position.x = clamp(this.avatar.position.x, -22, 22); this.avatar.position.z = clamp(this.avatar.position.z, -22, 22); this.dashCooldown = 5; this.camera.addShake(0.18); this.effects.ring(this.avatar.position.clone().setY(0.7), '#65f6ff'); this.playBuffer(this.audioBuffers.dash); this.message = 'CORTE DE FASE ejecutado.' }
  private doAbility(): void { if (!this.started || this.abilityCooldown > 0) return; this.abilityCooldown = 8; const pos = this.avatar.position.clone(); this.effects.ring(pos.setY(1.3), '#ff3b9d'); this.targets.forEach(t => { if (t.hp > 0 && t.root.position.distanceTo(this.avatar.position) < 9) t.root.children.forEach(o => { if (o instanceof THREE.Mesh) (o.material as THREE.MeshStandardMaterial).emissiveIntensity = 4 }) }); this.message = 'ECO PRISMA: objetivos cercanos marcados durante 3 s.'; this.playBuffer(this.audioBuffers.dash) }
  private interactIfRequested(): void { if (!this.requestedInteract) return; this.requestedInteract = false; const npc = this.npcs.find(n => n.root.position.distanceTo(this.avatar.position) < 3.3); if (npc) { this.npcMessage = `${npc.name}: ${npc.dialogue[npc.index % npc.dialogue.length]}`; npc.index += 1; this.message = `Interacción registrada con ${npc.name}.` } else { const chest = new THREE.Vector3(0, 0, 0); if (this.avatar.position.distanceTo(chest) < 4) { const rarity = this.rollRarity(); this.npcMessage = `Cofre de entrenamiento abierto: recompensa ${rarity}. Las recompensas reales se validan en servidor.`; this.message = 'Recompensa de práctica añadida al inventario local.'; this.playBuffer(this.audioBuffers.reward) } else this.message = 'No hay una interacción válida en alcance.' } }
  private rollRarity(): string { const weights = [['Común', 70], ['Poco común', 40], ['Rara', 30], ['Legendaria', 10], ['Mística', 5], ['Especial', 1]] as [string, number][]; const total = weights.reduce((s, [, w]) => s + w, 0); let value = Math.random() * total; for (const [name, weight] of weights) { value -= weight; if (value <= 0) return name } return 'Común' }
  private updateTracers(dt: number): void { for (let i = this.tracers.length - 1; i >= 0; i -= 1) { const t = this.tracers[i]; t.life -= dt; if (t.life <= 0) { t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); this.arena.scene.remove(t.line); this.tracers.splice(i, 1) } } }
  private playBuffer(buffer?: AudioBuffer): void { if (buffer) this.audio.playBuffer(buffer, 'sfx') }
}
