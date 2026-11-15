import * as THREE from 'three'
import type { Point, Role, Seat } from '../net/protocol'
import { CONFIG } from './config'

export function cameraSide(role: Role, spawn: Record<Seat, Point>): Point {
  if (role === 'spectator') return { x: 1, z: 1 }
  const p = spawn[role]; const len = Math.hypot(p.x, p.z)
  return len > 1e-6 ? { x: p.x / len, z: p.z / len } : { x: 0, z: 1 }
}
export function stickToWorld(side: Point, x: number, y: number): Point { const fx = -side.x, fz = -side.z; const rx = -fz, rz = fx; const wx = rx * x + fx * y, wz = rz * x + fz * y; const length = Math.hypot(wx, wz); return length > 1 ? { x: wx / length, z: wz / length } : { x: wx, z: wz } }

export type CameraMode = 'fps' | 'tps'

export class ArenaCamera {
  readonly camera = new THREE.PerspectiveCamera(76, 1, 0.05, 300)
  mode: CameraMode = 'fps'
  yaw = 0
  pitch = -0.08
  private shake = 0
  private recoil = 0
  private time = 0
  private readonly target = new THREE.Vector3()
  private side: Point = { x: 0, z: 1 }

  toggle(): void { this.mode = this.mode === 'fps' ? 'tps' : 'fps' }
  setSide(side: Point): void { this.side = side }
  addShake(amount: number): void { this.shake = Math.min(1, this.shake + amount) }
  addRecoil(amount = 0.035): void { this.recoil = Math.min(0.22, this.recoil + amount) }
  orbit(seconds: number): void { this.time += seconds; const t = this.time * 0.12; this.camera.position.set(Math.sin(t) * 28, 15 + Math.sin(this.time * 0.5) * 1.5, Math.cos(t) * 28); this.camera.lookAt(0, 2, 0) }
  update(position: { x: number; y: number; z: number } | null, seconds: number, reducedMotion: boolean): void {
    if (!position) {
      this.camera.fov = CONFIG.camera.fov
      this.camera.updateProjectionMatrix()
      this.camera.position.set(this.side.x * CONFIG.camera.distance, CONFIG.camera.height, this.side.z * CONFIG.camera.distance)
      this.camera.lookAt(0, 0, 0)
      return
    }
    this.time += seconds; this.recoil = Math.max(0, this.recoil - seconds * 0.26)
    const lookPitch = THREE.MathUtils.clamp(this.pitch - this.recoil, -1.35, 1.35)
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.cos(this.yaw) * Math.cos(lookPitch))
    if (this.mode === 'fps') {
      this.camera.position.set(position.x, position.y + 1.48, position.z)
      this.target.copy(this.camera.position).addScaledVector(forward, 18)
    } else {
      const follow = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(-5.5)
      const desired = new THREE.Vector3(position.x + follow.x, position.y + CONFIG.camera.height * 0.22, position.z + follow.z)
      this.camera.position.lerp(desired, 1 - Math.exp(-seconds * 12))
      this.target.set(position.x, position.y + 1.2, position.z).addScaledVector(forward, 10)
    }
    this.camera.lookAt(this.target)
    if (this.camera.fov !== CONFIG.camera.fov) { this.camera.fov = CONFIG.camera.fov; this.camera.updateProjectionMatrix() }
    if (this.shake > 0 && !reducedMotion) { const s = this.shake * this.shake * 0.06; this.camera.position.x += Math.sin(this.time * 58) * s; this.camera.position.y += Math.sin(this.time * 43 + 1) * s }
    this.shake = Math.max(0, this.shake - seconds * 3)
  }
}
