import * as THREE from 'three'
import { mat } from './materials'
import { rand } from '@/core/rand'

interface Particle {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  spin: THREE.Vector3
  life: number
  maxLife: number
}

const FUR_GEO = new THREE.PlaneGeometry(0.06, 0.11)
const CHUNK_GEO = new THREE.BoxGeometry(0.16, 0.16, 0.05)

/** Hạt lông bay, mảnh costume, chớp sáng khi bắn. */
export class Effects {
  private readonly particles: Particle[] = []
  private readonly flashLight: THREE.PointLight
  private flashTimer = 0

  constructor(private readonly scene: THREE.Scene) {
    this.flashLight = new THREE.PointLight(0xfff2cc, 0, 9, 2)
    scene.add(this.flashLight)
  }

  burst(pos: THREE.Vector3, color: number, kind: 'fur' | 'chunk', count = 40): void {
    const material = mat(color, { side: THREE.DoubleSide })
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(kind === 'fur' ? FUR_GEO : CHUNK_GEO, material)
      mesh.position.copy(pos).add(new THREE.Vector3(rand(-0.2, 0.2), rand(-0.3, 0.3), rand(-0.2, 0.2)))
      mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI))
      mesh.castShadow = kind === 'chunk'
      const speed = kind === 'fur' ? rand(1.5, 3.5) : rand(2, 4.5)
      const dir = new THREE.Vector3(rand(-1, 1), rand(0.3, 1.2), rand(-1, 1)).normalize()
      this.scene.add(mesh)
      this.particles.push({
        mesh,
        vel: dir.multiplyScalar(speed),
        spin: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
        life: 0,
        maxLife: kind === 'fur' ? rand(1.2, 2.0) : rand(1.6, 2.4),
      })
    }
  }

  flash(pos: THREE.Vector3): void {
    this.flashLight.position.copy(pos)
    this.flashLight.intensity = 30
    this.flashTimer = 0.07
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt
      if (this.flashTimer <= 0) this.flashLight.intensity = 0
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      const drag = p.mesh.geometry === FUR_GEO ? 0.96 : 0.995
      p.vel.multiplyScalar(drag)
      p.vel.y -= (p.mesh.geometry === FUR_GEO ? 2.5 : 9.8) * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.mesh.rotation.x += p.spin.x * dt
      p.mesh.rotation.y += p.spin.y * dt
      p.mesh.rotation.z += p.spin.z * dt
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02
        p.vel.y *= -0.3
        p.vel.x *= 0.6
        p.vel.z *= 0.6
        p.spin.multiplyScalar(0.5)
      }
      const k = p.life / p.maxLife
      if (k > 0.7) p.mesh.scale.setScalar(Math.max(0.001, 1 - (k - 0.7) / 0.3))
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh)
        this.particles.splice(i, 1)
      }
    }
  }
}
