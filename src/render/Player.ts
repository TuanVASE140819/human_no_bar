import * as THREE from 'three'
import type { Input } from '@/core/Input'
import { mat, canvasTexture, NO_OUTLINE_LAYER } from './materials'

export type Tool = 'hands' | 'gun'

/** Camera góc nhìn thứ nhất, di chuyển sau quầy, zoom soi, súng và bàn tay gorilla. */
export class Player {
  readonly camera: THREE.PerspectiveCamera
  yaw = 0
  pitch = 0
  readonly eyeHeight = 1.6
  readonly bounds = { minX: -2.0, maxX: 3.0, minZ: 2.4, maxZ: 3.25 }
  readonly baseFov = 70
  readonly zoomFov = 28
  zoom = 0
  tool: Tool = 'hands'
  moving = false

  private readonly viewmodel = new THREE.Group()
  private readonly handsGroup = new THREE.Group()
  private readonly gunGroup = new THREE.Group()
  private readonly muzzle = new THREE.Object3D()
  private flash: THREE.Sprite | null = null
  private flashLeft = 0
  private shake = 0
  private recoil = 0
  private pitchKick = 0
  private bobT = 0
  private bobY = 0

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.05, 120)
    this.camera.position.set(0.5, this.eyeHeight, 2.9)
    this.camera.rotation.order = 'YXZ'
    this.camera.layers.enable(NO_OUTLINE_LAYER)
    this.buildViewmodel()
    this.camera.add(this.viewmodel)
    this.setTool('hands')
  }

  private buildViewmodel(): void {
    const furM = mat(0x3d332d, { flat: false })
    const skinM = mat(0x4f423b, { flat: false })
    for (const sx of [-1, 1]) {
      const hand = new THREE.Group()
      hand.position.set(sx * 0.34, -0.31, -0.56)
      hand.rotation.x = 0.4
      hand.rotation.z = sx * 0.12
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), furM)
      palm.scale.set(1.15, 0.7, 1.35)
      hand.add(palm)
      const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 6, 12), furM)
      wrist.position.set(0, -0.01, 0.16)
      wrist.rotation.x = Math.PI / 2
      hand.add(wrist)
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.075, 4, 10), skinM)
        f.position.set(-0.045 + i * 0.03, 0.01, -0.12)
        f.rotation.x = Math.PI / 2 - 0.25
        hand.add(f)
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.05, 4, 10), skinM)
      thumb.position.set(sx * -0.085, 0.015, -0.03)
      thumb.rotation.z = sx * 0.9
      hand.add(thumb)
      this.handsGroup.add(hand)
    }
    this.viewmodel.add(this.handsGroup)

    const metal = mat(0x2a2a2a, { flat: false })
    const wood = mat(0x6b3f1d)
    this.gunGroup.position.set(0.26, -0.26, -0.5)
    for (const sx of [-1, 1]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.7, 10), metal)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(sx * 0.026, 0.02, -0.3)
      this.gunGroup.add(barrel)
    }
    const forend = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), wood)
    forend.position.set(0, -0.03, -0.18)
    this.gunGroup.add(forend)
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.24), metal)
    receiver.position.set(0, -0.01, 0.06)
    this.gunGroup.add(receiver)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.32), wood)
    stock.position.set(0, -0.06, 0.32)
    stock.rotation.x = -0.18
    this.gunGroup.add(stock)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.16), furM)
    grip.position.set(-0.01, -0.09, -0.18)
    this.gunGroup.add(grip)
    const rearHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.14), furM)
    rearHand.position.set(0, -0.1, 0.16)
    this.gunGroup.add(rearHand)
    this.muzzle.position.set(0, 0.02, -0.66)
    this.gunGroup.add(this.muzzle)

    // Chớp lửa đầu nòng: sprite cộng sáng, không vẽ viền
    const flashTex = canvasTexture(128, 128, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
      grad.addColorStop(0, 'rgba(255,255,230,1)')
      grad.addColorStop(0.25, 'rgba(255,214,120,0.9)')
      grad.addColorStop(0.6, 'rgba(255,140,40,0.35)')
      grad.addColorStop(1, 'rgba(255,120,20,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    })
    const flashMat = new THREE.SpriteMaterial({
      map: flashTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
    this.flash = new THREE.Sprite(flashMat)
    this.flash.scale.set(0.34, 0.34, 1)
    this.flash.position.copy(this.muzzle.position)
    this.flash.visible = false
    this.flash.layers.set(NO_OUTLINE_LAYER)
    this.gunGroup.add(this.flash)
    this.viewmodel.add(this.gunGroup)
  }

  /** Hướng sang phải của camera (để văng vỏ đạn) */
  get rightDir(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
  }

  setTool(tool: Tool): void {
    this.tool = tool
    this.handsGroup.visible = tool === 'hands'
    this.gunGroup.visible = tool === 'gun'
  }

  get isZooming(): boolean {
    return this.zoom > 0.5
  }

  get muzzleWorld(): THREE.Vector3 {
    const v = new THREE.Vector3()
    this.muzzle.getWorldPosition(v)
    return v
  }

  update(dt: number, input: Input, canControl: boolean): void {
    let zoomTarget = 0
    this.moving = false
    if (canControl && input.locked) {
      const sens = 0.0021 * THREE.MathUtils.lerp(1, 0.4, this.zoom)
      this.yaw -= input.mouseDX * sens
      this.pitch -= input.mouseDY * sens
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.35)

      let fx = 0
      let fz = 0
      if (input.isDown('KeyW')) fz += 1
      if (input.isDown('KeyS')) fz -= 1
      if (input.isDown('KeyA')) fx -= 1
      if (input.isDown('KeyD')) fx += 1
      if (fx !== 0 || fz !== 0) {
        const len = Math.hypot(fx, fz)
        fx /= len
        fz /= len
        const sy = Math.sin(this.yaw)
        const cy = Math.cos(this.yaw)
        const speed = 2.2 * (1 - this.zoom * 0.6)
        const dx = (-sy * fz + cy * fx) * speed * dt
        const dz = (-cy * fz - sy * fx) * speed * dt
        const p = this.camera.position
        p.x = THREE.MathUtils.clamp(p.x + dx, this.bounds.minX, this.bounds.maxX)
        p.z = THREE.MathUtils.clamp(p.z + dz, this.bounds.minZ, this.bounds.maxZ)
        this.moving = true
      }
      // Chuột phải, hoặc giữ Shift cho trackpad Mac
      zoomTarget = input.mouseDown[2] || input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 1 : 0
    }

    this.zoom = THREE.MathUtils.damp(this.zoom, zoomTarget, 14, dt)
    this.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.zoomFov, this.zoom)
    this.camera.updateProjectionMatrix()

    if (this.moving && this.zoom < 0.5) {
      this.bobT += dt * 9
      this.bobY = Math.sin(this.bobT) * 0.022
    } else {
      this.bobY = THREE.MathUtils.damp(this.bobY, 0, 10, dt)
    }
    this.camera.position.y = this.eyeHeight + this.bobY

    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 9, dt)
    this.pitchKick = THREE.MathUtils.damp(this.pitchKick, 0, 7, dt)
    this.shake = THREE.MathUtils.damp(this.shake, 0, 11, dt)
    this.gunGroup.position.z = -0.5 + this.recoil * 0.13
    this.gunGroup.rotation.x = this.recoil * 0.4
    // Rung camera nhẹ sau khi bắn
    const jx = (Math.random() - 0.5) * 0.02 * this.shake
    const jz = (Math.random() - 0.5) * 0.03 * this.shake
    this.camera.rotation.set(this.pitch + this.pitchKick + jx, this.yaw, jz)
    this.viewmodel.visible = this.zoom < 0.6

    if (this.flash && this.flashLeft > 0) {
      this.flashLeft -= dt
      if (this.flashLeft <= 0) this.flash.visible = false
    }
  }

  fire(): THREE.Raycaster {
    this.recoil = 1
    this.pitchKick = 0.05
    this.shake = 1
    if (this.flash) {
      this.flash.visible = true
      this.flash.material.rotation = Math.random() * Math.PI * 2
      this.flash.scale.setScalar(0.28 + Math.random() * 0.12)
      this.flashLeft = 0.06
    }
    const rc = new THREE.Raycaster()
    rc.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    return rc
  }

  centerRay(): THREE.Raycaster {
    const rc = new THREE.Raycaster()
    rc.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    return rc
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }
}
