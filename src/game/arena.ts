import * as THREE from 'three'

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number }

const C = { ground: '#294b36', floor: '#162b22', panel: '#1b2942', cyan: '#65f6ff', magenta: '#ff3b9d', amber: '#ffcc66', steel: '#34445d', glass: '#2a5d7a', grass: '#4f8b45', grassDark: '#244c32', earth: '#6b4d36', rock: '#59645b' }
const UNIT = new THREE.BoxGeometry(1, 1, 1)
const materials = new Map<string, THREE.MeshStandardMaterial>()
function grassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#4f8b45'; ctx.fillRect(0, 0, 128, 128)
  let seed = 77
  for (let i = 0; i < 900; i += 1) { seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed % 128; seed = (seed * 1664525 + 1013904223) >>> 0; const y = seed % 128; ctx.fillStyle = (seed & 1) ? '#376b3a' : '#72a94e'; ctx.fillRect(x, y, 1 + (seed % 2), 3 + (seed % 5)) }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(18, 18); texture.colorSpace = THREE.SRGBColorSpace; return texture
}
const GRASS = grassTexture()

function mat(color: string, emissive = '#000000', intensity = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive}|${intensity}`
  let material = materials.get(key)
  if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.12, emissive, emissiveIntensity: intensity }); if (color === C.ground) material.map = GRASS; materials.set(key, material) }
  return material
}

/** Mapa battle royale original: seis zonas, cofres repartidos y colisiones ligeras para móvil. */
export class Arena {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly world = new THREE.Group()
  readonly colliders: Collider[] = []
  readonly chestSpots: THREE.Vector3[] = []
  readonly bounds = 106
  private readonly dynamic = new THREE.Group()
  private readonly rng = mulberry32(90210)

  constructor(shadowMapSize: number) {
    this.scene.background = new THREE.Color('#070d1c')
    this.scene.fog = new THREE.Fog('#0a1326', 70, 230)
    this.scene.add(new THREE.HemisphereLight('#c6dcff', '#1b2738', 3.0))
    this.scene.add(new THREE.AmbientLight('#93b0d6', 0.9))
    this.sun = new THREE.DirectionalLight('#eaf6ff', 3.4)
    this.sun.position.set(-45, 70, 30)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    this.sun.shadow.camera.left = -70; this.sun.shadow.camera.right = 70; this.sun.shadow.camera.top = 70; this.sun.shadow.camera.bottom = -70
    this.sun.shadow.camera.far = 220
    this.scene.add(this.sun, this.sun.target)
    this.scene.add(this.world); this.world.add(this.dynamic)
    this.build()
  }
  setRadius(_radius: number): void { /* compatibilidad con el starter */ }
  addDynamic(object: THREE.Object3D): void { this.dynamic.add(object) }

  private build(): void {
    this.ground()
    this.city()
    this.port()
    this.forest()
    this.orbital()
    this.canyon()
    this.mountains()
    this.structures()
    this.center()
    this.boundary()
    this.skyline()
  }

  private ground(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(236, 236, 1, 1), mat(C.ground))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.world.add(floor)
    const zones: Array<[number, number, number, number, string]> = [
      [-55, -50, 62, 62, '#243149'], [55, -45, 58, 62, '#1f2a3c'], [-55, 55, 66, 66, '#173026'],
      [55, 55, 60, 60, '#2b2544'], [0, 92, 120, 30, '#3a2a22'], [0, 0, 40, 40, '#2d2233'],
    ]
    for (const [x, z, w, d, color] of zones) { const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color)); patch.rotation.x = -Math.PI / 2; patch.position.set(x, 0.02, z); patch.receiveShadow = true; this.world.add(patch) }
    const grid = new THREE.GridHelper(236, 59, '#1d2c42', '#162236'); grid.position.y = 0.01; const gm = grid.material as THREE.Material; gm.transparent = true; gm.opacity = 0.35; this.world.add(grid)
  }

  private city(): void {
    const baseX = -55, baseZ = -50
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) {
      if (this.rng() < 0.18) continue
      const w = 6 + this.rng() * 5, d = 6 + this.rng() * 5, h = 7 + this.rng() * 16
      const x = baseX + (i - 2.5) * 11, z = baseZ + (j - 2.5) * 11
      this.building(x, z, w, h, d, this.rng() < 0.5 ? C.cyan : C.magenta)
    }
    for (let i = 0; i < 14; i += 1) {
      const x = baseX + (this.rng() - 0.5) * 56, z = baseZ + (this.rng() - 0.5) * 56
      this.box(2.2, 1.4, 1.2, x, 0.7, z, mat('#26334a'), true)
    }
    for (let i = 0; i < 6; i += 1) this.chestSpot(baseX + (this.rng() - 0.5) * 52, baseZ + (this.rng() - 0.5) * 52)
  }

  private building(x: number, z: number, w: number, h: number, d: number, accent: string): void {
    this.box(w, h, d, x, h / 2, z, mat('#2a3a55'), true)
    const stripMaterial = mat(accent, accent, 1.4)
    for (let level = 2.4; level < h - 1; level += 3.2) {
      const front = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.16, 0.08), stripMaterial); front.position.set(x, level, z + d / 2 + 0.05); this.world.add(front)
      const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.16, 0.08), stripMaterial); back.position.set(x, level, z - d / 2 - 0.05); this.world.add(back)
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, d * 0.9), stripMaterial); side.position.set(x + w / 2 + 0.05, level, z); this.world.add(side)
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.3, d * 0.72), mat(C.panel)); roof.position.set(x, h + 0.15, z); this.world.add(roof)
  }

  private port(): void {
    const colors = ['#7a2f3a', '#2f4f7a', '#2f7a56', '#7a5a2f', '#4a3a7a']
    for (let i = 0; i < 34; i += 1) {
      const x = 38 + this.rng() * 40, z = -68 + this.rng() * 44
      const h = 2.4, w = 6.2, d = 2.5
      const color = colors[i % colors.length]
      this.box(w, h, d, x, h / 2, z, mat(color), true)
      if (this.rng() < 0.35) this.box(w, h, d, x + 0.1, h * 1.5 + 0.02, z, mat(color), true)
    }
    for (const [x, z] of [[36, -64], [72, -30], [40, -30]] as [number, number][]) {
      this.box(1.2, 16, 1.2, x, 8, z, mat(C.steel), true)
      this.box(10, 0.8, 1.2, x + 4.4, 15.4, z, mat(C.amber, C.amber, 0.8), false)
    }
    for (let i = 0; i < 5; i += 1) this.chestSpot(38 + this.rng() * 38, -66 + this.rng() * 40)
  }

  private forest(): void {
    for (let i = 0; i < 70; i += 1) {
      const x = -80 + this.rng() * 50, z = 30 + this.rng() * 50
      if (Math.abs(x + 55) < 8 && Math.abs(z - 55) < 8 && i % 3 === 0) continue
      const h = 5 + this.rng() * 7
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, h, 6), mat('#2a2233')); trunk.position.set(x, h / 2, z); trunk.castShadow = true; this.world.add(trunk)
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(1.5 + this.rng(), h * 0.9, 6), mat('#1f6b63', '#35ffd0', 0.7)); crystal.position.set(x, h + h * 0.35, z); crystal.castShadow = true; this.world.add(crystal)
      this.colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 })
    }
    for (let i = 0; i < 18; i += 1) this.box(1.6 + this.rng() * 2, 0.9, 1.4, -80 + this.rng() * 50, 0.45, 30 + this.rng() * 50, mat('#2b3a33'), true)
    for (let i = 0; i < 5; i += 1) this.chestSpot(-78 + this.rng() * 46, 32 + this.rng() * 46)
  }

  private orbital(): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.6, 32), mat('#2b2544')); base.position.set(55, 0.3, 55); base.receiveShadow = true; this.world.add(base)
    for (const [x, z, r, h] of [[45, 50, 6, 9], [64, 62, 7, 12], [56, 44, 5, 7]] as [number, number, number, number][]) {
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 20), mat('#1e2b45')); dome.position.set(x, h / 2 + 0.6, z); dome.castShadow = true; this.world.add(dome)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.3, 0.12, 6, 32), mat(C.magenta, C.magenta, 1.8)); ring.rotation.x = Math.PI / 2; ring.position.set(x, h * 0.7, z); this.world.add(ring)
      this.colliders.push({ minX: x - r * 0.85, maxX: x + r * 0.85, minZ: z - r * 0.85, maxZ: z + r * 0.85 })
    }
    for (let i = 0; i < 4; i += 1) this.chestSpot(44 + this.rng() * 20, 44 + this.rng() * 20)
  }

  private canyon(): void {
    for (let i = 0; i < 16; i += 1) {
      const x = -58 + (i % 8) * 16 + (this.rng() - 0.5) * 4, z = 86 + Math.floor(i / 8) * 14
      const h = 2 + this.rng() * 3
      this.box(9, h, 8, x, h / 2, z, mat('#3a2a22'), true)
      if (this.rng() < 0.5) this.box(8, 0.4, 2.2, x, h + 0.2, z + 4.6, mat('#4a3527'), false)
    }
    for (let i = 0; i < 3; i += 1) this.chestSpot(-50 + this.rng() * 100, 84 + this.rng() * 18)
  }

  private center(): void {
    const tower = this.box(16, 26, 16, 0, 13, 0, mat('#241c33'), true)
    const glow = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.5, 16.4), mat(C.cyan, C.cyan, 2.2)); glow.position.y = 20; tower.add(glow)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 10), mat(C.cyan, C.cyan, 1.6)); beam.position.y = 40; tower.add(beam)
    for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2; this.box(4, 2.4, 1.2, Math.cos(a) * 15, 1.2, Math.sin(a) * 15, mat(C.panel), true) }
    for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + 0.4; this.chestSpot(Math.cos(a) * 20, Math.sin(a) * 20) }
    for (let i = 0; i < 6; i += 1) { const a = (i / 6) * Math.PI * 2; this.chestSpot(Math.cos(a) * 46, Math.sin(a) * 46) }
  }


  private mountains(): void {
    const ring = [[-96, -72, 18, 28], [-82, 80, 24, 34], [88, 72, 22, 30], [94, -54, 17, 26], [0, 112, 30, 38]] as Array<[number, number, number, number]>
    for (const [x, z, radius, height] of ring) {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 9), mat(C.rock)); mountain.position.set(x, height / 2 - 2, z); mountain.rotation.y = (x + z) * 0.03; mountain.castShadow = true; mountain.receiveShadow = true; this.world.add(mountain)
      const grassCap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.72, height * 0.55, 9), mat(C.grassDark)); grassCap.position.set(x, height * 0.67, z); grassCap.rotation.y = mountain.rotation.y; grassCap.castShadow = true; this.world.add(grassCap)
    }
  }

  private structures(): void {
    const wood = mat('#785239'); const roof = mat('#263e35'); const trim = mat(C.amber, C.amber, 0.35)
    for (const [x, z, rot] of [[-22, 50, 0.2], [22, 46, -0.3], [76, 22, 0.1]] as Array<[number, number, number]>) {
      const hut = new THREE.Group(); hut.position.set(x, 0, z); hut.rotation.y = rot
      const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 6), wood); walls.position.y = 1.7; walls.castShadow = true; hut.add(walls)
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.5, 4), roof); roofMesh.rotation.y = Math.PI / 4; roofMesh.position.y = 4.5; roofMesh.castShadow = true; hut.add(roofMesh)
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.08), trim); sign.position.set(0, 2.4, 3.05); hut.add(sign)
      this.world.add(hut); this.colliders.push({ minX: x - 4, maxX: x + 4, minZ: z - 3, maxZ: z + 3 })
    }
    for (const [x, z, w] of [[-42, 17, 26], [34, 15, 22]] as Array<[number, number, number]>) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 5), mat(C.earth)); ramp.position.set(x, 0.6, z); ramp.rotation.z = x < 0 ? -0.12 : 0.12; ramp.castShadow = true; this.world.add(ramp)
    }
  }

  private boundary(): void {
    const b = this.bounds
    for (const [x, z, w, d] of [[0, -b, 2 * b, 3], [0, b, 2 * b, 3], [-b, 0, 3, 2 * b], [b, 0, 3, 2 * b]] as [number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 16, d), new THREE.MeshStandardMaterial({ color: C.magenta, emissive: C.magenta, emissiveIntensity: 0.55, transparent: true, opacity: 0.22, side: THREE.DoubleSide }))
      wall.position.set(x, 8, z); this.world.add(wall)
      this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 })
    }
  }

  private skyline(): void {
    const skyline = new THREE.Group()
    for (let i = 0; i < 46; i += 1) {
      const a = (i / 46) * Math.PI * 2; const r = 118 + (i % 6) * 4; const h = 8 + (i % 7) * 4
      const building = new THREE.Mesh(UNIT, mat(i % 2 ? '#0c1322' : '#111c2e')); building.scale.set(4 + (i % 3), h, 4 + ((i + 1) % 3)); building.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); skyline.add(building)
    }
    this.world.add(skyline)
  }

  private chestSpot(x: number, z: number): void { this.chestSpots.push(new THREE.Vector3(x, 0, z)) }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, collide: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(UNIT, material); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; this.world.add(mesh)
    if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 })
    return mesh
  }
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
