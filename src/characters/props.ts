import * as THREE from 'three'
import { mat } from '@/render/materials'

const SMOOTH = { flat: false } as const

/** Trụ nối hai điểm (tọa độ không gian thân nhân vật) */
function tube(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, material: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 12), material)
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  mesh.castShadow = true
  return mesh
}

function ball(r: number, material: THREE.Material, p: THREE.Vector3, seg = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), material)
  mesh.position.copy(p)
  mesh.castShadow = true
  return mesh
}

/**
 * Kèn saxophone alto cầm trước ngực: ống thổi từ mỏ xuống thân, cong ở đáy rồi loe loa lên trên.
 * Tọa độ theo không gian thân nhân vật (vai ở y≈1.3, mỏ ở y≈1.7). Trả về nhóm và miệng loa để nhịp theo nốt.
 */
export function buildSax(): { group: THREE.Group; bell: THREE.Mesh } {
  const brass = mat(0xd9a93a, SMOOTH)
  const brassDark = mat(0x9c7420, SMOOTH)
  const pearl = mat(0xf5f0e0, SMOOTH)
  const black = mat(0x1a1a1a, SMOOTH)
  const g = new THREE.Group()
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  const mouth = v(-0.02, 1.66, 0.5)
  const neckEnd = v(0.1, 1.48, 0.42)
  const bodyEnd = v(0.19, 0.8, 0.3)
  const bowEnd = v(0.27, 0.98, 0.54)
  const bellEnd = v(0.31, 1.12, 0.6)

  g.add(tube(v(-0.04, 1.69, 0.52), mouth, 0.011, 0.014, black))
  g.add(tube(mouth, neckEnd, 0.014, 0.022, brass))
  g.add(ball(0.024, brassDark, neckEnd))
  g.add(tube(neckEnd, bodyEnd, 0.026, 0.056, brass))
  g.add(ball(0.078, brass, v(0.21, 0.75, 0.38), 14))
  g.add(tube(v(0.22, 0.76, 0.42), bowEnd, 0.055, 0.07, brass))
  const bell = tube(bowEnd, bellEnd, 0.07, 0.125, brass)
  g.add(bell)
  g.add(ball(0.03, brassDark, bellEnd, 10))

  // Phím ngọc và trục đồng dọc thân kèn
  for (let i = 0; i < 6; i++) {
    const t = 0.12 + i * 0.14
    const p = neckEnd.clone().lerp(bodyEnd, t)
    g.add(ball(0.014, pearl, v(p.x + 0.035, p.y, p.z + 0.03), 8))
    g.add(ball(0.009, brassDark, v(p.x + 0.045, p.y - 0.02, p.z + 0.015), 6))
  }
  g.add(tube(v(0.14, 1.42, 0.45), v(0.23, 0.86, 0.33), 0.005, 0.005, brassDark))
  // Dây đeo cổ
  g.add(tube(v(0.0, 1.5, 0.08), v(0.12, 1.3, 0.38), 0.008, 0.008, black))
  g.add(tube(v(0.0, 1.5, 0.08), v(-0.1, 1.38, 0.3), 0.008, 0.008, black))
  return { group: g, bell }
}
