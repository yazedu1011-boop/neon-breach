import type { Input } from '../engine/input'

/** Controles multitáctiles Android: stick izquierdo para mover y derecho para mirar. */
export class TouchControls {
  private moveId: number | null = null
  private lookId: number | null = null
  private moveOrigin = { x: 0, y: 0 }
  private lookOrigin = { x: 0, y: 0 }
  private readonly moveStick: HTMLElement
  private readonly moveKnob: HTMLElement
  private readonly lookStick: HTMLElement
  private readonly lookKnob: HTMLElement
  private readonly radius = 62

  constructor(root: HTMLElement, private readonly input: Input, private readonly active: () => boolean) {
    const layer = root.querySelector<HTMLElement>('.touch')!
    this.moveStick = layer.querySelector<HTMLElement>('[data-stick="move"]')!
    this.moveKnob = this.moveStick.querySelector<HTMLElement>('i')!
    this.lookStick = layer.querySelector<HTMLElement>('[data-stick="look"]')!
    this.lookKnob = this.lookStick.querySelector<HTMLElement>('i')!

    const enable = () => document.body.classList.add('has-touch')
    if (matchMedia('(pointer: coarse)').matches) enable()
    window.addEventListener('touchstart', enable, { once: true, passive: true })
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') this.input.method = 'touch' }, { capture: true })

    const canvas = document.querySelector<HTMLCanvasElement>('#game')!
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !this.active()) return
      const half = window.innerWidth / 2
      if (e.clientX < half && this.moveId === null) this.begin('move', e)
      else if (e.clientX >= half && this.lookId === null) this.begin('look', e)
    })
    window.addEventListener('pointermove', e => this.move(e))
    window.addEventListener('pointerup', e => this.end(e))
    window.addEventListener('pointercancel', e => this.end(e))
  }

  private begin(kind: 'move' | 'look', e: PointerEvent): void {
    e.preventDefault()
    if (kind === 'move') { this.moveId = e.pointerId; this.moveOrigin = { x: e.clientX, y: e.clientY }; this.place(this.moveStick, e); this.moveStick.classList.add('is-active') }
    else { this.lookId = e.pointerId; this.lookOrigin = { x: e.clientX, y: e.clientY }; this.place(this.lookStick, e); this.lookStick.classList.add('is-active') }
  }

  private place(stick: HTMLElement, e: PointerEvent): void { stick.style.left = `${e.clientX}px`; stick.style.top = `${e.clientY}px` }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.moveId && e.pointerId !== this.lookId) return
    const isMove = e.pointerId === this.moveId
    const origin = isMove ? this.moveOrigin : this.lookOrigin
    let dx = e.clientX - origin.x
    let dy = e.clientY - origin.y
    const len = Math.hypot(dx, dy)
    if (len > this.radius) { dx = (dx / len) * this.radius; dy = (dy / len) * this.radius }
    const knob = isMove ? this.moveKnob : this.lookKnob
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    if (isMove) this.input.setTouchMove(dx / this.radius, -dy / this.radius)
    else this.input.setTouchLook(dx / this.radius, dy / this.radius)
  }

  private end(e: PointerEvent): void {
    if (e.pointerId === this.moveId) { this.moveId = null; this.moveKnob.style.transform = ''; this.moveStick.classList.remove('is-active'); this.input.setTouchMove(0, 0) }
    if (e.pointerId === this.lookId) { this.lookId = null; this.lookKnob.style.transform = ''; this.lookStick.classList.remove('is-active'); this.input.setTouchLook(0, 0) }
  }
}
