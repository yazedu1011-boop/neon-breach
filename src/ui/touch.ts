import type { Input } from '../engine/input'

/**
 * Controles móviles estilo battle royale: joystick fijo a la izquierda para mover y arrastre del dedo
 * en cualquier zona libre para girar la cámara. No hay joystick derecho.
 */
export class TouchControls {
  private moveId: number | null = null
  private lookId: number | null = null
  private lookLast = { x: 0, y: 0 }
  private readonly stick: HTMLElement
  private readonly knob: HTMLElement
  private readonly radius = 58

  constructor(root: HTMLElement, private readonly input: Input, private readonly active: () => boolean) {
    this.stick = root.querySelector<HTMLElement>('[data-stick="move"]')!
    this.knob = this.stick.querySelector<HTMLElement>('i')!
    const enable = () => document.body.classList.add('has-touch')
    if (matchMedia('(pointer: coarse)').matches) enable()
    window.addEventListener('touchstart', enable, { once: true, passive: true })
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') this.input.method = 'touch' }, { capture: true })

    this.stick.addEventListener('pointerdown', e => {
      if (!this.active()) return
      e.preventDefault(); e.stopPropagation()
      this.moveId = e.pointerId
      this.stick.classList.add('is-active')
      this.stick.setPointerCapture?.(e.pointerId)
      this.trackMove(e)
    })
    this.stick.addEventListener('pointermove', e => { if (e.pointerId === this.moveId) { e.preventDefault(); this.trackMove(e) } })
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.moveId) { this.moveId = null; this.knob.style.transform = ''; this.stick.classList.remove('is-active'); this.input.setTouchMove(0, 0) }
      if (e.pointerId === this.lookId) this.lookId = null
    }
    this.stick.addEventListener('pointerup', release)
    this.stick.addEventListener('pointercancel', release)

    const canvas = document.querySelector<HTMLCanvasElement>('#game')!
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !this.active()) return
      this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY }
    })
    window.addEventListener('pointermove', e => {
      if (e.pointerId !== this.lookId) return
      const dx = e.clientX - this.lookLast.x; const dy = e.clientY - this.lookLast.y
      this.lookLast = { x: e.clientX, y: e.clientY }
      this.input.addTouchLook(dx * 0.75, dy * 0.75)
    })
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  }

  private trackMove(e: PointerEvent): void {
    const rect = this.stick.getBoundingClientRect()
    const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2
    let dx = e.clientX - cx; let dy = e.clientY - cy
    const length = Math.hypot(dx, dy)
    if (length > this.radius) { dx = (dx / length) * this.radius; dy = (dy / length) * this.radius }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`
    const dead = 0.12
    const nx = dx / this.radius; const ny = -dy / this.radius
    this.input.setTouchMove(Math.abs(nx) < dead ? 0 : nx, Math.abs(ny) < dead ? 0 : ny)
  }
}
