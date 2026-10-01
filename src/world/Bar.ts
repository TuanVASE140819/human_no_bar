import * as THREE from 'three'
import { mat, texMat, glowMat, box, placed, canvasTexture, NO_OUTLINE_LAYER } from '@/render/materials'
import type { LampSpec } from '@/render/Lighting'
import { DRINKS } from '@/data/drinks'
import { tweens, Easing } from '@/core/Tween'
import { rand, pick } from '@/core/rand'

export interface BarWorld {
  group: THREE.Group
  doorPivot: THREE.Group
  openDoor(): void
  closeDoor(): void
  setClock(minutes: number): void
  lamps: LampSpec[]
  counterSpot: THREE.Vector3
  doorSpot: THREE.Vector3
  spawnSpot: THREE.Vector3
}

const W = 12
const D = 8
const H = 3.5
const T = 0.2

const WALL = 0xeadbc3
const CEILING = 0xf1e5d0
const WOOD_DARK = 0x4e3320
const WOOD = 0x8b5a2b
const WOOD_LIGHT = 0xa9714b
const TRIM = 0x5a3a1e
const BRASS = 0xd4af37
const LEATHER = 0x7a2e2e
const LEAF = [0x3f8f45, 0x4da052, 0x357a3c]

const SMOOTH = { flat: false } as const

// ---------- Texture vẽ bằng canvas ----------

function plankTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(1024, 1024, (ctx, w, h) => {
    const rows = 6
    const rh = h / rows
    ctx.fillStyle = '#5a3a1c'
    ctx.fillRect(0, 0, w, h)
    for (let r = 0; r < rows; r++) {
      let x = -((r * 173) % 320)
      while (x < w) {
        const len = 360 + ((r * 97 + Math.abs(x) * 3) % 260)
        const shade = 0.88 + rand(0, 0.22)
        const warm = rand(-8, 8)
        const cr = Math.round(150 * shade + warm)
        const cg = Math.round(96 * shade)
        const cb = Math.round(48 * shade - warm)
        ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`
        ctx.fillRect(x + 2, r * rh + 2, len - 4, rh - 4)
        // Vân gỗ
        ctx.strokeStyle = 'rgba(40, 20, 8, 0.16)'
        ctx.lineWidth = 2
        for (let g = 0; g < 5; g++) {
          const gy = r * rh + 18 + g * (rh / 5.5) + rand(-6, 6)
          ctx.beginPath()
          ctx.moveTo(x + 8, gy)
          ctx.bezierCurveTo(x + len * 0.3, gy + rand(-10, 10), x + len * 0.7, gy + rand(-10, 10), x + len - 8, gy + rand(-4, 4))
          ctx.stroke()
        }
        // Mắt gỗ thỉnh thoảng
        if (rand(0, 1) < 0.3) {
          ctx.fillStyle = 'rgba(40, 20, 8, 0.25)'
          ctx.beginPath()
          ctx.ellipse(x + rand(60, len - 60), r * rh + rh / 2 + rand(-20, 20), 14, 7, rand(0, 1), 0, Math.PI * 2)
          ctx.fill()
        }
        // Đinh ở hai đầu
        ctx.fillStyle = 'rgba(20, 12, 6, 0.5)'
        ctx.beginPath()
        ctx.arc(x + 16, r * rh + rh / 2, 3, 0, Math.PI * 2)
        ctx.arc(x + len - 16, r * rh + rh / 2, 3, 0, Math.PI * 2)
        ctx.fill()
        x += len
      }
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 3.4)
  return tex
}

function posterTexture(): THREE.CanvasTexture {
  return canvasTexture(384, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e63946'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    ctx.fillRect(16, 16, w - 32, h - 32)
    ctx.fillStyle = '#e63946'
    ctx.fillRect(28, 28, w - 56, h - 56)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 74px "Baloo 2", "Segoe UI", sans-serif'
    ctx.fillText('KHÔNG', w / 2, 150)
    ctx.fillText('NGƯỜI', w / 2, 230)
    ctx.beginPath()
    ctx.arc(w / 2, 340, 70, 0, Math.PI * 2)
    ctx.lineWidth = 12
    ctx.strokeStyle = '#fff'
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(w / 2 - 50, 290)
    ctx.lineTo(w / 2 + 50, 390)
    ctx.stroke()
    ctx.fillStyle = '#1b1f3b'
    ctx.beginPath()
    ctx.arc(w / 2, 320, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(w / 2 - 30, 345, 60, 45)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 26px "Baloo 2", "Segoe UI", sans-serif'
    ctx.fillText('Thấy người? Bắn.', w / 2, 460)
  })
}

function menuTexture(): THREE.CanvasTexture {
  return canvasTexture(768, 432, (ctx, w, h) => {
    ctx.fillStyle = '#233524'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#c9a96a'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, w - 20, h - 20)
    ctx.fillStyle = '#f7f1e1'
    ctx.textAlign = 'center'
    ctx.font = 'bold 54px "Baloo 2", "Segoe UI", sans-serif'
    ctx.fillText('MENU', w / 2, 70)
    ctx.strokeStyle = 'rgba(247,241,225,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(60, 88)
    ctx.lineTo(w - 60, 88)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.font = '30px "Baloo 2", "Segoe UI", sans-serif'
    const items = Object.values(DRINKS)
    items.forEach((d, i) => {
      const col = i < 4 ? 0 : 1
      const row = i % 4
      const x = 50 + col * 360
      const y = 140 + row * 62
      ctx.fillStyle = '#f7f1e1'
      ctx.fillText(d.name, x, y)
      ctx.fillStyle = '#ffd27f'
      ctx.textAlign = 'right'
      ctx.fillText(`$${d.price}`, x + 300, y)
      ctx.textAlign = 'left'
    })
  })
}

function clockFaceTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f7f1e1'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#3a2a1e'
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.fillStyle = '#3a2a1e'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = i % 3 === 0 ? 14 : 6
      ctx.beginPath()
      ctx.arc(w / 2 + Math.sin(a) * 95, h / 2 - Math.cos(a) * 95, r / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/** Chân dung "khách danh dự" treo tường: đầu thú đơn giản trên nền màu. */
function portraitTexture(bg: string, fur: string, ears: 'round' | 'pointed'): THREE.CanvasTexture {
  return canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2 + 10, 110, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = fur
    if (ears === 'round') {
      ctx.beginPath()
      ctx.arc(w / 2 - 55, h / 2 - 60, 26, 0, Math.PI * 2)
      ctx.arc(w / 2 + 55, h / 2 - 60, 26, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(w / 2 - 70, h / 2 - 30)
      ctx.lineTo(w / 2 - 50, h / 2 - 105)
      ctx.lineTo(w / 2 - 15, h / 2 - 50)
      ctx.moveTo(w / 2 + 70, h / 2 - 30)
      ctx.lineTo(w / 2 + 50, h / 2 - 105)
      ctx.lineTo(w / 2 + 15, h / 2 - 50)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f5ede0'
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2 + 22, 34, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(w / 2 - 24, h / 2 - 10, 7, 0, Math.PI * 2)
    ctx.arc(w / 2 + 24, h / 2 - 10, 7, 0, Math.PI * 2)
    ctx.arc(w / 2, h / 2 + 14, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e63946'
    ctx.beginPath()
    ctx.moveTo(w / 2 - 22, h / 2 + 60)
    ctx.lineTo(w / 2, h / 2 + 70)
    ctx.lineTo(w / 2 - 22, h / 2 + 80)
    ctx.moveTo(w / 2 + 22, h / 2 + 60)
    ctx.lineTo(w / 2, h / 2 + 70)
    ctx.lineTo(w / 2 + 22, h / 2 + 80)
    ctx.fill()
  })
}

// ---------- Các cụm đồ vật ----------

function tree(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.add(placed(new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 1.5 * s, 8), mat(0x6b4a2e, SMOOTH), 0, 0.75 * s, 0))
  const crowns: [number, number, number, number][] = [
    [0, 2.0, 0, 0.95],
    [0.55, 1.6, 0.25, 0.7],
    [-0.5, 1.7, -0.2, 0.72],
    [0.1, 1.45, -0.5, 0.6],
  ]
  crowns.forEach(([cx, cy, cz, r], i) => {
    g.add(placed(new THREE.SphereGeometry(r * s, 12, 9), mat(LEAF[i % LEAF.length], SMOOTH), cx * s, cy * s, cz * s))
  })
  return g
}

function building(x: number, z: number, w: number, h: number, color: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.add(box(w, h, 5, mat(color), 0, h / 2, 0))
  g.add(box(w + 0.3, 0.25, 5.3, mat(0x4a3b36), 0, h + 0.1, 0))
  const winM = mat(0x2b3542)
  const cols = Math.max(2, Math.floor(w / 1.4))
  const rows = Math.max(1, Math.floor(h / 2.4))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + (c + 0.5) * (w / cols)
      const wy = 1.4 + r * 2.4
      g.add(box(0.7, 1.0, 0.06, winM, wx, wy, 2.53, false))
    }
  }
  return g
}

function lampPost(x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const iron = mat(0x2b2b2b)
  g.add(placed(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8), iron, 0, 1.6, 0))
  g.add(placed(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8), iron, 0, 0.06, 0))
  g.add(box(0.36, 0.06, 0.36, iron, 0, 3.22, 0))
  g.add(box(0.28, 0.32, 0.28, glowMat(0xfff4d6, 0xffe2a0, 0.5), 0, 3.42, 0, false))
  g.add(box(0.4, 0.06, 0.4, iron, 0, 3.62, 0))
  return g
}

function stool(x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const iron = mat(0x2f2f2f, SMOOTH)
  g.add(placed(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16), iron, 0, 0.015, 0))
  g.add(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), iron, 0, 0.37, 0))
  const ring = placed(new THREE.TorusGeometry(0.16, 0.012, 6, 16), iron, 0, 0.24, 0)
  ring.rotation.x = Math.PI / 2
  g.add(ring)
  g.add(placed(new THREE.CylinderGeometry(0.19, 0.17, 0.08, 16), mat(LEATHER, SMOOTH), 0, 0.76, 0))
  return g
}

function plant(x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.add(placed(new THREE.CylinderGeometry(0.2, 0.15, 0.34, 12), mat(0xb5643c, SMOOTH), 0, 0.17, 0))
  g.add(placed(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 12), mat(0x3a2a1a, SMOOTH), 0, 0.345, 0))
  const leafs: [number, number, number, number][] = [
    [0, 0.72, 0, 0.32],
    [0.22, 0.58, 0.1, 0.24],
    [-0.2, 0.62, -0.08, 0.26],
    [0.05, 0.55, -0.24, 0.22],
    [-0.02, 0.95, 0.05, 0.22],
  ]
  leafs.forEach(([lx, ly, lz, r], i) => {
    g.add(placed(new THREE.SphereGeometry(r, 10, 8), mat(LEAF[i % LEAF.length], SMOOTH), lx, ly, lz))
  })
  return g
}

function barrel(x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.add(placed(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 14), mat(0x6a4426, SMOOTH), 0, 0.4, 0))
  const band = mat(0x3a3a3a, SMOOTH)
  for (const y of [0.15, 0.65]) {
    g.add(placed(new THREE.CylinderGeometry(0.315, 0.315, 0.05, 14), band, 0, y, 0))
  }
  return g
}

/** Đèn tường: giá sắt, chụp hướng lên, bóng phát sáng. Dựng theo hướng +z, xoay ngoài. */
function sconce(bulbs: THREE.MeshToonMaterial[]): THREE.Group {
  const g = new THREE.Group()
  const iron = mat(0x2b2b2b)
  g.add(box(0.08, 0.28, 0.03, iron, 0, 0, 0.015))
  g.add(box(0.05, 0.05, 0.2, iron, 0, 0.08, 0.12))
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.17, 14, 1, true), mat(0x2d4a3a, { side: THREE.DoubleSide, flat: false }))
  shade.position.set(0, 0.16, 0.22)
  shade.rotation.x = Math.PI
  shade.castShadow = true
  g.add(shade)
  const bulb = glowMat(0xffe9b8, 0xffd27f)
  bulbs.push(bulb)
  g.add(placed(new THREE.SphereGeometry(0.055, 10, 8), bulb, 0, 0.18, 0.22))
  return g
}

export function buildBar(scene: THREE.Scene): BarWorld {
  const group = new THREE.Group()
  scene.add(group)

  const wallM = mat(WALL, { soft: true })
  const trimM = mat(TRIM)
  const woodDarkM = mat(WOOD_DARK)
  const counterM = mat(WOOD_DARK, { soft: true })
  const woodM = mat(WOOD)
  const woodLightM = mat(WOOD_LIGHT)
  const topM = mat(0x94603a, { soft: true })
  const woodSmoothM = mat(WOOD, SMOOTH)
  const woodDarkSmoothM = mat(WOOD_DARK, SMOOTH)
  const brassM = mat(BRASS, SMOOTH)
  const lamps: LampSpec[] = []

  // ---------- Sàn, trần ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), texMat(plankTexture(), { soft: true }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(CEILING, { side: THREE.BackSide, soft: true }))
  ceiling.rotation.x = -Math.PI / 2
  ceiling.position.y = H
  ceiling.receiveShadow = true
  group.add(ceiling)
  for (const bx of [-4.8, -2.4, 0, 2.4, 4.8]) {
    group.add(box(0.18, 0.22, D, woodDarkM, bx, H - 0.11, 0))
  }
  group.add(box(W, 0.22, 0.18, woodDarkM, 0, H - 0.11, -D / 2 + 0.09))
  group.add(box(W, 0.22, 0.18, woodDarkM, 0, H - 0.11, D / 2 - 0.09))

  // ---------- Ngoài trời ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x5f8c4a, { soft: true }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  ground.receiveShadow = true
  group.add(ground)
  const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.6), mat(0x9d9b93, { soft: true }))
  sidewalk.rotation.x = -Math.PI / 2
  sidewalk.position.set(0, -0.01, -5.4)
  sidewalk.receiveShadow = true
  group.add(sidewalk)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(34, 6.5), mat(0x4a4f55, { soft: true }))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, -0.012, -10)
  road.receiveShadow = true
  group.add(road)
  const dashM = mat(0xe8c547)
  for (let i = -7; i <= 7; i++) {
    group.add(box(1.2, 0.01, 0.16, dashM, i * 2.4, -0.005, -10, false))
  }
  const facades = [0xc98d7a, 0x8fa3b8, 0xd7b98a, 0x9ab08a, 0xb28aa3, 0xa8968a, 0xc4a88c]
  let bx = -15
  let i = 0
  while (bx < 15) {
    const bw = rand(3.5, 5.5)
    const bh = rand(4.5, 9)
    group.add(building(bx + bw / 2, -16.5 - rand(0, 1.5), bw, bh, facades[i % facades.length]))
    bx += bw + rand(0.6, 1.4)
    i += 1
  }
  group.add(tree(-4.4, -7.6, 1.1), tree(4.8, -7.8, 1.0), tree(9.5, -6.8, 0.9), tree(-9.6, -1.6, 1.15), tree(-9.3, 2.4, 1.0))
  group.add(lampPost(1.9, -5.1))

  // ---------- Tường ----------
  // Tường sau (z = +4)
  group.add(box(W + 0.4, H, T, wallM, 0, H / 2, D / 2 + T / 2))
  // Tường trước (z = -4) chừa cửa
  group.add(box(5.55, H, T, wallM, -3.425, H / 2, -D / 2 - T / 2))
  group.add(box(5.55, H, T, wallM, 3.425, H / 2, -D / 2 - T / 2))
  group.add(box(1.3, 1.1, T, wallM, 0, 2.95, -D / 2 - T / 2))
  // Khung cửa
  group.add(box(0.12, 2.4, T + 0.06, trimM, -0.66, 1.2, -D / 2 - T / 2))
  group.add(box(0.12, 2.4, T + 0.06, trimM, 0.66, 1.2, -D / 2 - T / 2))
  group.add(box(1.44, 0.12, T + 0.06, trimM, 0, 2.46, -D / 2 - T / 2))
  // Tường phải (x = +6) + cửa kho
  group.add(box(T, H, D + 0.4, wallM, W / 2 + T / 2, H / 2, 0))
  group.add(box(0.06, 2.2, 1.0, woodDarkM, W / 2 - 0.03, 1.1, 2.6))
  group.add(box(0.08, 2.3, 1.1, trimM, W / 2 - 0.02, 1.15, 2.6))
  group.add(box(0.05, 2.2, 1.0, woodDarkM, W / 2 - 0.07, 1.1, 2.6))
  group.add(placed(new THREE.SphereGeometry(0.04, 8, 6), brassM, W / 2 - 0.12, 1.05, 2.25))
  // Tường trái (x = -6) chừa 2 cửa sổ
  group.add(box(T, 1.2, D + 0.4, wallM, -W / 2 - T / 2, 0.6, 0))
  group.add(box(T, 1.1, D + 0.4, wallM, -W / 2 - T / 2, 2.95, 0))
  group.add(box(T, 1.2, 1.3, wallM, -W / 2 - T / 2, 1.8, -3.35))
  group.add(box(T, 1.2, 2.1, wallM, -W / 2 - T / 2, 1.8, -0.25))
  group.add(box(T, 1.2, 1.8, wallM, -W / 2 - T / 2, 1.8, 3.1))
  const glassM = mat(0xbfe3ff, { transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  for (const zc of [-2.0, 1.5]) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), glassM)
    glass.rotation.y = Math.PI / 2
    glass.position.set(-W / 2, 1.8, zc)
    glass.layers.set(NO_OUTLINE_LAYER)
    group.add(glass)
    group.add(box(0.08, 1.2, 0.06, trimM, -W / 2, 1.8, zc))
    group.add(box(0.08, 0.06, 1.4, trimM, -W / 2, 1.8, zc))
    group.add(box(0.1, 0.08, 1.5, trimM, -W / 2, 1.2, zc))
    group.add(box(0.1, 0.08, 1.5, trimM, -W / 2, 2.4, zc))
    group.add(box(0.1, 1.3, 0.08, trimM, -W / 2, 1.8, zc - 0.72))
    group.add(box(0.1, 1.3, 0.08, trimM, -W / 2, 1.8, zc + 0.72))
    group.add(box(0.22, 0.05, 1.7, woodLightM, -W / 2 + 0.08, 1.17, zc))
  }
  // Ốp chân tường + nẹp
  group.add(box(W, 1.0, 0.04, trimM, 0, 0.5, D / 2 - 0.02))
  group.add(box(5.3, 1.0, 0.04, trimM, -3.35, 0.5, -D / 2 + 0.02))
  group.add(box(5.3, 1.0, 0.04, trimM, 3.35, 0.5, -D / 2 + 0.02))
  group.add(box(0.04, 1.0, D, trimM, -W / 2 + 0.02, 0.5, 0))
  group.add(box(0.04, 1.0, D, trimM, W / 2 - 0.02, 0.5, 0))
  group.add(box(W, 0.06, 0.07, woodLightM, 0, 1.03, D / 2 - 0.035))
  group.add(box(5.3, 0.06, 0.07, woodLightM, -3.35, 1.03, -D / 2 + 0.035))
  group.add(box(5.3, 0.06, 0.07, woodLightM, 3.35, 1.03, -D / 2 + 0.035))
  group.add(box(0.07, 0.06, D, woodLightM, -W / 2 + 0.035, 1.03, 0))
  group.add(box(0.07, 0.06, D, woodLightM, W / 2 - 0.035, 1.03, 0))
  // Thảm chùi chân
  group.add(box(1.3, 0.02, 0.7, mat(0x6b4d3a), 0, 0.01, -3.5, false))

  // ---------- Cửa chính (bản lề trái, mở ra ngoài) ----------
  const doorPivot = new THREE.Group()
  doorPivot.position.set(-0.6, 0, -D / 2)
  doorPivot.add(box(1.2, 2.35, 0.08, woodDarkM, 0.6, 1.175, 0))
  doorPivot.add(box(0.9, 0.9, 0.02, woodM, 0.6, 1.6, 0.05))
  doorPivot.add(box(0.9, 0.7, 0.02, woodM, 0.6, 0.6, 0.05))
  doorPivot.add(placed(new THREE.SphereGeometry(0.045, 8, 6), brassM, 1.05, 1.1, 0.08))
  group.add(doorPivot)

  // ---------- Quầy bar chữ L ----------
  group.add(box(6.0, 1.05, 0.65, counterM, 0.5, 0.525, 1.825))
  group.add(box(6.2, 0.06, 0.8, woodM, 0.5, 1.08, 1.825))
  group.add(box(6.24, 0.03, 0.84, topM, 0.5, 1.115, 1.825))
  for (let k = 0; k < 7; k++) {
    group.add(box(0.7, 0.62, 0.03, woodM, -2.14 + k * 0.88, 0.6, 1.485))
  }
  group.add(box(6.0, 0.06, 0.03, woodLightM, 0.5, 0.98, 1.49))
  group.add(box(6.0, 0.06, 0.03, woodLightM, 0.5, 0.2, 1.49))
  const rail = placed(new THREE.CylinderGeometry(0.02, 0.02, 5.7, 10), brassM, 0.5, 0.2, 1.36)
  rail.rotation.z = Math.PI / 2
  group.add(rail)
  for (const rx of [-1.9, 0.5, 2.9]) group.add(box(0.05, 0.05, 0.14, brassM, rx, 0.2, 1.43))
  group.add(box(0.65, 1.05, 2.0, counterM, 3.825, 0.525, 2.5))
  group.add(box(0.8, 0.06, 2.1, woodM, 3.825, 1.08, 2.5))
  group.add(box(0.84, 0.03, 2.14, topM, 3.825, 1.115, 2.5))
  group.add(stool(-1.6, 1.0), stool(2.6, 1.0))

  // Đồ trên quầy
  group.add(box(0.36, 0.28, 0.32, mat(0x3d3d3d), 2.6, 1.27, 1.9))
  group.add(box(0.3, 0.12, 0.02, mat(0x7fd6a0, { emissive: 0x2f8f5a, emissiveIntensity: 0.6 }), 2.6, 1.35, 1.73))
  group.add(box(1.1, 0.012, 0.32, mat(0x1f1a17), 0.5, 1.136, 1.72, false))
  const glassCup = mat(0xdfeeff, { transparent: true, opacity: 0.45, flat: false })
  for (let c = 0; c < 4; c++) {
    group.add(placed(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 12), glassCup, -1.4 + c * 0.18, 1.2, 2.05))
  }
  const chrome = mat(0xc9ccd1, SMOOTH)
  group.add(placed(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 12), chrome, 1.6, 1.05, 3.7))
  const tap = placed(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 10), chrome, 2.0, 1.28, 2.0)
  group.add(tap)
  const spout = placed(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), chrome, 2.0, 1.36, 1.92)
  spout.rotation.x = Math.PI / 2
  group.add(spout)
  group.add(placed(new THREE.CylinderGeometry(0.02, 0.028, 0.18, 8), mat(0x6b3f1d, SMOOTH), 2.0, 1.52, 2.0))

  // ---------- Quầy sau + kệ rượu ----------
  group.add(box(5.5, 0.9, 0.5, counterM, 0.5, 0.45, 3.75))
  group.add(box(5.6, 0.05, 0.55, woodM, 0.5, 0.925, 3.75))
  group.add(box(5.4, 1.72, 0.04, mat(0x3b2515, { soft: true }), 0.5, 2.06, 3.97))
  const bottleColors = [0x8b1a1a, 0x2e8b57, 0xdaa520, 0x3f7bbf, 0xd2691e, 0x7b3f9e, 0x5d7a2f, 0xc23b3b, 0x2f9fb0, 0xe0a030]
  const shelfGlow: THREE.MeshToonMaterial[] = []
  for (const sy of [1.5, 2.0, 2.5]) {
    group.add(box(5.0, 0.04, 0.28, woodM, 0.5, sy, 3.85))
    group.add(box(0.06, 0.5, 0.26, trimM, -2.0, sy - 0.25, 3.85))
    group.add(box(0.06, 0.5, 0.26, trimM, 3.0, sy - 0.25, 3.85))
    const strip = glowMat(0xffe0a0, 0xffd27f, 0.6)
    shelfGlow.push(strip)
    group.add(box(4.9, 0.02, 0.05, strip, 0.5, sy - 0.03, 3.73, false))
    for (let b = 0; b < 10; b++) {
      const hgt = rand(0.24, 0.38)
      const x = -1.75 + b * 0.47 + rand(-0.05, 0.05)
      const c = mat(pick(bottleColors), SMOOTH)
      group.add(placed(new THREE.CylinderGeometry(0.05, 0.05, hgt, 12), c, x, sy + 0.02 + hgt / 2, 3.85))
      group.add(placed(new THREE.CylinderGeometry(0.02, 0.025, 0.1, 8), c, x, sy + 0.02 + hgt + 0.05, 3.85))
      group.add(placed(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), mat(0x2a2a2a, SMOOTH), x, sy + 0.02 + hgt + 0.11, 3.85))
      group.add(box(0.1, 0.08, 0.002, mat(0xf3ead6), x, sy + 0.02 + hgt / 2, 3.79))
    }
  }

  // ---------- Bảng menu, poster, đồng hồ, tranh ----------
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.07), texMat(menuTexture()))
  menu.position.set(-3.6, 2.7, D / 2 - 0.045)
  menu.rotation.y = Math.PI
  group.add(menu)
  group.add(box(2.0, 1.17, 0.04, woodM, -3.6, 2.7, D / 2 - 0.01))

  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), texMat(posterTexture()))
  poster.position.set(3.0, 2.1, -D / 2 + 0.02)
  group.add(poster)

  const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), texMat(clockFaceTexture(), { transparent: true }))
  clockFace.position.set(4.6, 2.85, D / 2 - 0.03)
  clockFace.rotation.y = Math.PI
  group.add(clockFace)
  const handM = mat(0x2a1a10)
  const hourHand = box(0.03, 0.15, 0.01, handM, 4.6, 2.85, D / 2 - 0.05, false)
  const minuteHand = box(0.02, 0.22, 0.008, handM, 4.6, 2.85, D / 2 - 0.06, false)
  hourHand.geometry.translate(0, 0.06, 0)
  minuteHand.geometry.translate(0, 0.09, 0)
  group.add(hourHand, minuteHand)

  const portraits: [number, string, string, 'round' | 'pointed'][] = [
    [-1.3, '#264653', '#6b4423', 'round'],
    [0.6, '#5a3d6e', '#e0782a', 'pointed'],
  ]
  for (const [pz, bg, fur, ears] of portraits) {
    group.add(box(0.06, 0.95, 0.75, mat(0x3a2618), W / 2 - 0.03, 2.05, pz))
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), texMat(portraitTexture(bg, fur, ears)))
    pic.position.set(W / 2 - 0.065, 2.05, pz)
    pic.rotation.y = -Math.PI / 2
    group.add(pic)
  }

  // ---------- Bàn ghế ----------
  const tableSpots: [number, number][] = [
    [-4.2, -2.2],
    [-4.2, 1.0],
    [4.3, -2.4],
    [4.3, 0.2],
  ]
  for (const [tx, tz] of tableSpots) {
    group.add(placed(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 24), woodSmoothM, tx, 0.75, tz))
    group.add(placed(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10), woodDarkSmoothM, tx, 0.375, tz))
    group.add(placed(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 16), woodDarkSmoothM, tx, 0.02, tz))
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4
      const cx = tx + Math.cos(a) * 0.85
      const cz = tz + Math.sin(a) * 0.85
      const chair = new THREE.Group()
      chair.position.set(cx, 0, cz)
      chair.rotation.y = -a + Math.PI / 2
      chair.add(box(0.4, 0.05, 0.4, woodLightM, 0, 0.45, 0))
      chair.add(box(0.4, 0.45, 0.05, woodLightM, 0, 0.7, 0.18))
      chair.add(box(0.3, 0.04, 0.3, mat(LEATHER), 0, 0.49, 0))
      for (const [lx, lz] of [
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ]) {
        chair.add(box(0.04, 0.45, 0.04, woodDarkM, lx, 0.225, lz))
      }
      group.add(chair)
    }
    group.add(placed(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 12), glassCup, tx + 0.15, 0.85, tz - 0.1))
    group.add(placed(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), mat(0xf3ead6, SMOOTH), tx - 0.2, 0.79, tz + 0.12))
  }

  // ---------- Góc phòng ----------
  for (const [cx, cy, cz] of [
    [5.4, 0.3, -3.4],
    [4.8, 0.3, -3.5],
    [5.4, 0.9, -3.4],
  ]) {
    group.add(box(0.6, 0.6, 0.6, mat(0x9c7a52), cx, cy, cz))
    group.add(box(0.62, 0.05, 0.62, mat(0x7a5a38), cx, cy + 0.2, cz, false))
  }
  group.add(barrel(-5.45, -3.45), plant(-5.5, 3.5), plant(5.55, 1.3))

  // ---------- Đèn ----------
  const sconceSpots: [number, number, number, number][] = [
    [-5.4, 2.2, D / 2 - 0.03, Math.PI],
    [5.4, 2.2, D / 2 - 0.03, Math.PI],
    [-1.7, 2.3, -D / 2 + 0.03, 0],
    [1.7, 2.3, -D / 2 + 0.03, 0],
  ]
  for (const [sx, sy, sz, ry] of sconceSpots) {
    const bulbs: THREE.MeshToonMaterial[] = []
    const s = sconce(bulbs)
    s.position.set(sx, sy, sz)
    s.rotation.y = ry
    group.add(s)
    const dir = ry === 0 ? 1 : -1
    lamps.push({ position: new THREE.Vector3(sx, sy + 0.25, sz + dir * 0.3), bulbs, intensity: 3.5, distance: 5, dayLevel: 0.3 })
  }

  for (const lx of [-1.5, 0.5, 2.5]) {
    const lz = 1.8
    group.add(placed(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 6), mat(0x222222), lx, H - 0.4, lz))
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.28, 18, 1, true), mat(0x2d4a3a, { side: THREE.DoubleSide, flat: false }))
    shade.position.set(lx, H - 0.85, lz)
    shade.castShadow = true
    group.add(shade)
    const inner = glowMat(0xffe9b8, 0xd9a85a, 0.35)
    const innerShade = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.25, 18, 1, true), inner)
    innerShade.material.side = THREE.BackSide
    innerShade.position.set(lx, H - 0.86, lz)
    group.add(innerShade)
    const bulbM = glowMat(0xffe9b8, 0xffd27f)
    group.add(placed(new THREE.SphereGeometry(0.07, 12, 10), bulbM, lx, H - 0.95, lz))
    const bulbs = [bulbM, inner]
    if (lx === 0.5) bulbs.push(...shelfGlow)
    lamps.push({ position: new THREE.Vector3(lx, H - 1.05, lz), bulbs, intensity: 9, distance: 7, dayLevel: 0.28 })
  }

  let doorTween: ReturnType<typeof tweens.add> | null = null
  const swing = (to: number) => {
    doorTween?.cancel()
    const from = doorPivot.rotation.y
    doorTween = tweens.add({
      duration: 0.7,
      ease: Easing.inOutQuad,
      onUpdate: (t) => {
        doorPivot.rotation.y = THREE.MathUtils.lerp(from, to, t)
      },
    })
  }

  return {
    group,
    doorPivot,
    openDoor: () => swing(1.9),
    closeDoor: () => swing(0),
    setClock: (minutes: number) => {
      const h = (minutes / 60) % 12
      const mm = minutes % 60
      // Mặt đồng hồ quay về phía người chơi (nhìn từ -z) nên quay dương = chiều kim đồng hồ
      hourHand.rotation.z = (h / 12) * Math.PI * 2
      minuteHand.rotation.z = (mm / 60) * Math.PI * 2
    },
    lamps,
    counterSpot: new THREE.Vector3(0.5, 0, 0.55),
    doorSpot: new THREE.Vector3(0, 0, -3.6),
    spawnSpot: new THREE.Vector3(0, 0, -5.2),
  }
}
