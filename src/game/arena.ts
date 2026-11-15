import * as THREE from 'three'

const C = { floor: '#111a2c', panel: '#1b2942', cyan: '#65f6ff', magenta: '#ff3b9d', amber: '#ffcc66', steel: '#34445d' }
function mat(color: string, emissive = '#000000', intensity = 0): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.32, emissive, emissiveIntensity: intensity }) }
function box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], material: THREE.Material, bevel = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh)
  if (bevel) { const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.26 })); mesh.add(edge) }
  return mesh
}
function neonLine(parent: THREE.Object3D, pos: [number, number, number], rot: [number, number, number], color: string): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), mat(color, color, 2.2)); mesh.position.set(...pos); mesh.rotation.set(...rot); parent.add(mesh)
}

export class Arena {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly world = new THREE.Group()
  private readonly dynamic = new THREE.Group()
  constructor(shadowMapSize: number) {
    this.scene.background = new THREE.Color('#050916')
    this.scene.fog = new THREE.Fog('#050916', 35, 120)
    this.scene.add(new THREE.HemisphereLight('#9ab8ff', '#080a15', 1.55))
    this.sun = new THREE.DirectionalLight('#d9f5ff', 2.4); this.sun.position.set(-18, 30, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize); this.scene.add(this.sun, this.sun.target)
    this.scene.add(this.world); this.world.add(this.dynamic)
    this.build()
  }
  setRadius(_radius: number): void { /* compatibilidad con el starter */ }
  addDynamic(object: THREE.Object3D): void { this.dynamic.add(object) }
  private build(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), mat(C.floor)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.world.add(floor)
    const grid = new THREE.GridHelper(64, 32, '#243a59', '#15243a'); grid.position.y = 0.015; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.54; this.world.add(grid)
    const border = new THREE.Mesh(new THREE.RingGeometry(23.7, 24, 96), new THREE.MeshBasicMaterial({ color: C.magenta, transparent: true, opacity: 0.75, side: THREE.DoubleSide })); border.rotation.x = -Math.PI / 2; border.position.y = 0.035; this.world.add(border)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.045, 6, 96), mat(C.cyan, C.cyan, 2.5)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; this.world.add(ring)
    const core = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.14, 64), mat('#14233b', C.cyan, 0.8)); core.position.y = 0.07; this.world.add(core)
    // Cover lanes and vertical sightline blockers.
    const cover = mat(C.panel)
    for (const [x, z, w, d, h] of [[-12, -5, 5, 1.8, 1.7], [12, 5, 5, 1.8, 1.7], [-3, 10, 1.8, 5, 1.5], [3, -10, 1.8, 5, 1.5], [-15, 12, 2.2, 2.2, 3.4], [15, -12, 2.2, 2.2, 3.4]] as [number, number, number, number, number][]) box(this.world, [w, h, d], [x, h / 2, z], cover, 1)
    for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]] as [number, number][]) {
      box(this.world, [0.8, 7, 0.8], [x, 3.5, z], mat(C.steel), 1); neonLine(this.world, [x, 3.2, z], [0, 0, 0], (x * z > 0) ? C.cyan : C.magenta)
    }
    for (const [x, z, color] of [[-20, 0, C.cyan], [20, 0, C.magenta], [0, -20, C.amber], [0, 20, C.cyan]] as [number, number, string][]) {
      const sign = box(this.world, [3.8, 1.6, 0.12], [x, 5.5, z], mat('#0b1222', color, 1.8), 1); sign.rotation.y = x === 0 ? 0 : Math.PI / 2
    }
    const beacon = new THREE.PointLight(C.cyan, 18, 16, 2); beacon.position.set(0, 4.5, 0); this.world.add(beacon)
    const beacon2 = new THREE.PointLight(C.magenta, 11, 18, 2); beacon2.position.set(13, 3, -12); this.world.add(beacon2)
    this.addSkyline()
  }
  private addSkyline(): void {
    const skyline = new THREE.Group()
    for (let i = 0; i < 30; i += 1) {
      const a = (i / 30) * Math.PI * 2; const r = 34 + (i % 5) * 2; const h = 4 + (i % 6) * 1.8
      const building = box(skyline, [2 + (i % 3), h, 2 + ((i + 1) % 3)], [Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r], mat(i % 2 ? '#0c1322' : '#111c2e'))
      if (i % 2 === 0) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.72, 0.06), mat(C.cyan, C.cyan, 1.5)); strip.position.set(0.55, 0, 1.01); building.add(strip) }
    }
    this.world.add(skyline)
  }
}
