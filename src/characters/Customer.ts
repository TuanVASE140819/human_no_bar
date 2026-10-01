import * as THREE from 'three'
import { buildCharacter, buildHumanReveal, type CharacterRig } from './buildCharacter'
import type { CustomerSpec } from './generateCustomers'
import { tweens, Easing } from '@/core/Tween'
import { rand } from '@/core/rand'

export type CustomerState = 'entering' | 'waiting' | 'turning' | 'leaving' | 'down' | 'gone'

export const PATIENCE_SECONDS = 45

export class Customer {
  readonly rig: CharacterRig
  state: CustomerState = 'entering'
  patience = PATIENCE_SECONDS
  readonly asked = { turn: false, slogan: false, question: false }

  private target: THREE.Vector3 | null = null
  private onArrive: (() => void) | null = null
  private readonly speed = 1.7
  private walkT = 0
  private blinkTimer = rand(1.5, 4)
  private blinkLeft = 0
  private facingTarget = 0
  private talkLeft = 0
  private readonly canBlink: boolean

  constructor(
    readonly spec: CustomerSpec,
    private readonly scene: THREE.Scene,
    spawn: THREE.Vector3,
  ) {
    this.rig = buildCharacter(spec.species, spec.clues, spec.quirk, spec.furColor, spec.look)
    this.rig.root.position.copy(spawn)
    this.canBlink = !spec.clues.has('plasticEyes')
    scene.add(this.rig.root)
  }

  get root(): THREE.Group {
    return this.rig.root
  }

  get position(): THREE.Vector3 {
    return this.rig.root.position
  }

  /** Điểm giữa ngực, dùng cho hiệu ứng. */
  get chest(): THREE.Vector3 {
    return this.position.clone().add(new THREE.Vector3(0, 1.0 * this.rig.baseScale, 0))
  }

  walkTo(target: THREE.Vector3, cb?: () => void): void {
    this.target = target.clone()
    this.onArrive = cb ?? null
    const d = this.target.clone().sub(this.position)
    this.facingTarget = Math.atan2(d.x, d.z)
  }

  face(yaw: number): void {
    this.facingTarget = yaw
  }

  talk(seconds = 1.4): void {
    this.talkLeft = seconds
  }

  /** Quay lưng lại vài giây (để lộ khóa kéo / đuôi) rồi quay về. */
  turnAround(onDone?: () => void): void {
    if (this.state !== 'waiting') return
    this.state = 'turning'
    this.asked.turn = true
    this.facingTarget = Math.PI
    tweens.delay(3.2, () => {
      if (this.state !== 'turning') return
      this.facingTarget = 0
      this.state = 'waiting'
      onDone?.()
    })
  }

  update(dt: number): void {
    const root = this.rig.root
    if (this.state === 'down' || this.state === 'gone') return

    let diff = this.facingTarget - root.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    root.rotation.y += diff * Math.min(1, dt * 6)

    let moving = false
    if (this.target && (this.state === 'entering' || this.state === 'leaving')) {
      const d = this.target.clone().sub(root.position)
      d.y = 0
      const dist = d.length()
      if (dist < 0.05) {
        root.position.x = this.target.x
        root.position.z = this.target.z
        this.target = null
        const cb = this.onArrive
        this.onArrive = null
        cb?.()
      } else {
        const step = Math.min(dist, this.speed * dt)
        root.position.addScaledVector(d.normalize(), step)
        this.walkT += dt * 9
        root.position.y = Math.abs(Math.sin(this.walkT)) * 0.05
        this.rig.body.rotation.z = Math.sin(this.walkT) * 0.05
        moving = true
      }
    } else {
      root.position.y *= 0.8
      this.rig.body.rotation.z *= 0.8
    }

    // Tay chân, thở, gật đầu, há miệng do rig tự lo (procedural hoặc clip Blender)
    this.rig.update(dt, moving, this.talkLeft > 0)
    if (this.talkLeft > 0) this.talkLeft -= dt

    if (this.canBlink) {
      this.blinkTimer -= dt
      if (this.blinkTimer <= 0) {
        this.blinkLeft = 0.13
        this.blinkTimer = rand(2, 5)
      }
      if (this.blinkLeft > 0) this.blinkLeft -= dt
      const sy = this.blinkLeft > 0 ? 0.12 : 1
      for (const e of this.rig.eyes) e.scale.y += (sy - e.scale.y) * Math.min(1, dt * 40)
    }
  }

  /** Ngã ra sau. reveal = true thì costume biến mất, lộ người bên trong. */
  knockDown(reveal: boolean, onRemoved: () => void): void {
    this.state = 'down'
    this.target = null
    const root = this.rig.root
    root.rotation.y = 0
    // Biểu cảm hoảng: mày nhướng, mắt mở to, miệng há
    for (const b of this.rig.brows) b.position.y += 0.04
    for (const e of this.rig.eyes) e.scale.setScalar(1.15)
    this.rig.setMouth(0.7)
    this.talkLeft = 0
    if (reveal) {
      this.rig.body.visible = false
      root.add(buildHumanReveal())
    }
    tweens.add({
      duration: 0.55,
      ease: Easing.inQuad,
      onUpdate: (t) => {
        root.rotation.x = -t * Math.PI * 0.49
        root.position.y = t * 0.08
      },
    })
    tweens.add({
      duration: 1.0,
      delay: 3.2,
      ease: Easing.inQuad,
      onUpdate: (t) => {
        root.position.y = 0.08 - t * 1.6
      },
      onComplete: () => {
        this.remove()
        onRemoved()
      },
    })
  }

  remove(): void {
    if (this.state === 'gone') return
    this.state = 'gone'
    this.scene.remove(this.rig.root)
    this.rig.dispose()
  }
}
