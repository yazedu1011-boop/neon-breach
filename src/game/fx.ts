import * as THREE from 'three'
type Particle = { life: number; max: number; pos: THREE.Vector3; vel: THREE.Vector3; size: number; color: THREE.Color; gravity: number }
const MAX = 520
export class Effects {
  readonly mesh: THREE.InstancedMesh
  private particles: Particle[] = []
  private readonly dummy = new THREE.Object3D()
  constructor() {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), material, MAX); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, new THREE.Color())
  }
  burst(at: THREE.Vector3, color: THREE.ColorRepresentation, count = 24, speed = 6): void { const c = new THREE.Color(color); for (let i = 0; i < count; i += 1) { const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize(); this.spawn({ life: 0, max: 0.25 + Math.random() * 0.45, pos: at.clone(), vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.6)), size: 0.6 + Math.random() * 1.2, color: c, gravity: -12 }) } }
  ring(at: THREE.Vector3, color: THREE.ColorRepresentation): void { const c = new THREE.Color(color); for (let i = 0; i < 22; i += 1) { const a = i / 22 * Math.PI * 2; this.spawn({ life: 0, max: 0.6, pos: at.clone(), vel: new THREE.Vector3(Math.cos(a), 0.05, Math.sin(a)).multiplyScalar(4.5), size: 0.5, color: c, gravity: 0 }) } }
  private spawn(p: Particle): void { if (this.particles.length >= MAX) this.particles.shift(); this.particles.push(p) }
  update(dt: number): void { this.particles = this.particles.filter(p => (p.life += dt) < p.max); this.particles.forEach((p, i) => { p.vel.y += p.gravity * dt; p.vel.multiplyScalar(1 - 2.2 * dt); p.pos.addScaledVector(p.vel, dt); const k = 1 - p.life / p.max; this.dummy.position.copy(p.pos); this.dummy.scale.setScalar(p.size * k); this.dummy.rotation.set(p.life * 6, p.life * 4, 0); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, p.color) }); this.mesh.count = this.particles.length; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true }
  clear(): void { this.particles = []; this.mesh.count = 0 }
}
