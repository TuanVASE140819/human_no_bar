import * as THREE from 'three'
import type { SpeciesDef } from '@/data/species'
import type { ClueId, Quirk } from '@/data/clues'
import { mat, darken, disposeTree, toonGradient } from '@/render/materials'
import { rand } from '@/core/rand'
import { tweens, Easing } from '@/core/Tween'
import { hasModel, instantiateModel, type ModelInstance } from './models'

/** Hướng đầu nhìn về người chơi (radian, trong không gian nhân vật) */
export interface HeadLook {
  yaw: number
  pitch: number
}

export type Mood = 'neutral' | 'scared' | 'suspicious'

/** Lông mày, mí mắt, độ mở mắt và miệng theo biểu cảm; dùng chung cho rig procedural và rig model. */
class Face {
  private lidOpen = -0.6
  private blinkK = 0
  /** Độ há miệng nền khi không nói (sợ thì hơi há) */
  mouthBase = 0

  constructor(
    private readonly brows: THREE.Object3D[],
    private readonly lids: THREE.Object3D[],
    private readonly eyes: THREE.Object3D[],
  ) {}

  setMood(mood: Mood): void {
    const cfg =
      mood === 'scared'
        ? { y: 0.25, tilt: 0.08, lid: -0.85, eye: 1.1, mouth: 0.3 }
        : mood === 'suspicious'
          ? { y: 0.17, tilt: 0.6, lid: 0.4, eye: 1.0, mouth: 0 }
          : { y: 0.2, tilt: 0.2, lid: -0.6, eye: 1.0, mouth: 0 }
    this.brows.forEach((b, i) => {
      const sx = i === 0 ? -1 : 1
      b.position.y = cfg.y
      const bar = b.children[0]
      if (bar) bar.rotation.z = sx * (-Math.PI / 2 + cfg.tilt)
    })
    for (const e of this.eyes) e.scale.setScalar(cfg.eye)
    this.lidOpen = cfg.lid
    this.mouthBase = cfg.mouth
    this.applyBlink()
  }

  setBlink(k: number): void {
    this.blinkK = THREE.MathUtils.clamp(k, 0, 1)
    this.applyBlink()
  }

  private applyBlink(): void {
    const rx = THREE.MathUtils.lerp(this.lidOpen, 1.45, this.blinkK)
    for (const l of this.lids) l.rotation.x = rx
  }
}

export type Accessory = 'bowtie' | 'scarf' | 'sash' | 'suspenders' | 'hat' | 'beret' | 'coat' | 'shades'
/** Phụ kiện khách ngẫu nhiên (áo khoác và kính đen dành cho nhân vật cốt truyện) */
export const ACCESSORIES: Accessory[] = ['bowtie', 'scarf', 'sash', 'suspenders', 'hat', 'beret']
export const ACCENT_COLORS = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0x8d5a97, 0xf4a261, 0x1d3557, 0x6a994e]

/** Phụ kiện và màu nhấn riêng của từng khách, không liên quan manh mối. */
export interface CharacterLook {
  accessory: Accessory | null
  accent: number
  /** Phụ kiện thêm (đặc vụ: áo khoác + mũ + kính) */
  extras?: Accessory[]
}

function allAccessories(look: CharacterLook): Accessory[] {
  const list: Accessory[] = []
  if (look.accessory) list.push(look.accessory)
  if (look.extras) list.push(...look.extras)
  return list
}

export interface CharacterRig {
  root: THREE.Group
  /** Toàn bộ costume (ẩn đi khi lộ người bên trong) */
  body: THREE.Object3D
  head: THREE.Object3D
  eyes: THREE.Object3D[]
  ears: THREE.Object3D[]
  hands: THREE.Object3D[]
  brows: THREE.Object3D[]
  /** 0 = ngậm, 1 = há to */
  setMouth(open: number): void
  /** 0 = mở mắt, 1 = nhắm (mí trên kéo xuống) */
  setBlink(k: number): void
  /** Biểu cảm: bình thường, sợ (thấy súng), nghi ngờ (bị soi) */
  setMood(mood: Mood): void
  /** Chơi một lần cử chỉ (vẫy chào, nâng ly uống); trả về thời lượng giây */
  playOnce(name: 'Wave' | 'Drink'): number
  /** Cầm ly có màu đồ uống ở tay phải / bỏ ly */
  holdGlass(color: number): void
  releaseGlass(): void
  /** Animation mỗi khung: đi / đứng / nói, đầu hướng về look nếu có */
  update(dt: number, moving: boolean, talking: boolean, look: HeadLook | null): void
  baseScale: number
  furColor: number
  /** true khi dựng từ model Blender (glTF) */
  fromModel: boolean
  dispose(): void
}

const SKIN = 0xe3b48b
const SHOE = 0x2b1d14
const SOLE = 0xb8a78f
const ZIPPER = 0xd0d0d0
const MOUTH = 0x2a1612
const TONGUE = 0xe07a8a
const IVORY = 0xf2ead8
const SMOOTH = { flat: false } as const
/** Tâm đầu trong không gian thân (trước khi nhân species.height) */
const HEAD_Y = 1.84
/** Vị trí x cổ tay và cánh tay trên trong model Blender, theo bề ngang thân (arm_xs trong tools/blender/build_characters.py) */
function modelArmX(species: SpeciesDef): { wrist: number; upper: number } {
  const t = species.torsoScale * 0.31
  return { wrist: t + 0.11, upper: t + 0.13 }
}

const bodyMatCache = new Map<string, THREE.MeshToonMaterial>()

/**
 * Vật liệu thân cho model Blender: màu lông là màu chính, các vùng bụng / mảng mặt / mõm
 * trộn theo mặt nạ vertex color (R, G, B) nên ranh giới mượt, không răng cưa theo tam giác.
 */
function bodyMaterial(furColor: number, species: SpeciesDef, withAo: boolean): THREE.MeshToonMaterial {
  const key = `${furColor}|${species.id}|${withAo ? 'ao' : ''}`
  const cached = bodyMatCache.get(key)
  if (cached) return cached
  const m = new THREE.MeshToonMaterial({ color: furColor, gradientMap: toonGradient(), vertexColors: true })
  if (withAo) m.defines = { USE_BAKED_AO: '' }
  const belly = new THREE.Color(species.bellyColor)
  const mask = new THREE.Color(species.maskColor ?? species.furColor)
  const snout = new THREE.Color(species.snoutColor)
  const band = new THREE.Color(species.bandColor ?? species.furColor)
  m.onBeforeCompile = (shader) => {
    shader.uniforms.bellyColor = { value: belly }
    shader.uniforms.maskColor = { value: mask }
    shader.uniforms.snoutColor = { value: snout }
    shader.uniforms.bandColor = { value: band }
    // Bóng tiếp xúc nướng sẵn (_AO từ Blender) truyền qua varying
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <color_pars_vertex>',
        '#include <color_pars_vertex>\n#ifdef USE_BAKED_AO\nattribute float _ao;\nvarying float vAo;\n#endif',
      )
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_BAKED_AO\nvAo = _ao;\n#endif')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <color_pars_fragment>',
        '#include <color_pars_fragment>\nuniform vec3 bellyColor;\nuniform vec3 maskColor;\nuniform vec3 snoutColor;\nuniform vec3 bandColor;\n#ifdef USE_BAKED_AO\nvarying float vAo;\n#endif',
      )
      .replace(
        '#include <color_fragment>',
        `vec3 regionColor = diffuseColor.rgb;
        regionColor = mix(regionColor, bellyColor, vColor.r);
        regionColor = mix(regionColor, maskColor, vColor.g);
        regionColor = mix(regionColor, snoutColor, vColor.b);
        #ifdef USE_COLOR_ALPHA
        regionColor = mix(regionColor, bandColor, vColor.a);
        #endif
        #ifdef USE_BAKED_AO
        regionColor *= mix(0.62, 1.0, vAo);
        #endif
        diffuseColor.rgb = regionColor;`,
      )
  }
  m.customProgramCacheKey = () => (withAo ? 'body-region-mask-ao' : 'body-region-mask')
  bodyMatCache.set(key, m)
  return m
}

/** Ly đồ uống cầm tay: cốc thủy tinh mờ + chất lỏng màu món; gốc ở đáy ly. */
function buildGlass(color: number): THREE.Group {
  const g = new THREE.Group()
  const glassM = mat(0xdfeeff, { transparent: true, opacity: 0.45, flat: false })
  const cup = m(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 12), glassM, 0, 0.08, 0)
  cup.castShadow = false
  g.add(cup)
  g.add(m(new THREE.CylinderGeometry(0.05, 0.042, 0.105, 12), mat(color, SMOOTH), 0, 0.055, 0))
  return g
}

const DEFAULT_LOOK: CharacterLook = { accessory: null, accent: 0xe63946 }

// ---------- Khối cơ bản ----------

function m(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

function sphere(r: number, material: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 16): THREE.Mesh {
  const mesh = m(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75))), material, x, y, z)
  mesh.scale.set(sx, sy, sz)
  return mesh
}

function capsule(r: number, len: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return m(new THREE.CapsuleGeometry(r, len, 6, 14), material, x, y, z)
}

// ---------- Bộ phận dùng chung cho cả hai kiểu rig ----------

function buildHumanHand(): THREE.Group {
  const g = new THREE.Group()
  const skin = mat(SKIN, SMOOTH)
  g.add(m(new THREE.BoxGeometry(0.11, 0.13, 0.05), skin, 0, -0.03, 0))
  for (let i = 0; i < 4; i++) {
    g.add(m(new THREE.CylinderGeometry(0.013, 0.012, 0.11, 8), skin, -0.042 + i * 0.028, -0.15, 0))
  }
  const thumb = m(new THREE.CylinderGeometry(0.014, 0.013, 0.08, 8), skin, 0.075, -0.06, 0.01)
  thumb.rotation.z = -0.6
  g.add(thumb)
  return g
}

function buildPaw(furDark: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  g.add(sphere(0.07, furDark, 0, -0.03, 0, 1.05, 0.8, 1.25))
  const claw = mat(0x3a3a3a, SMOOTH)
  for (let i = -1; i <= 1; i++) {
    g.add(sphere(0.034, furDark, i * 0.046, -0.095, 0.03, 1, 1, 1, 10))
    g.add(sphere(0.014, claw, i * 0.046, -0.125, 0.045, 1, 1, 1, 8))
  }
  g.add(sphere(0.03, furDark, 0.072, -0.045, 0.02, 1, 1, 1, 10))
  return g
}

/** Giày người, gốc ở tâm bàn chân. */
function buildShoe(): THREE.Group {
  const shoe = new THREE.Group()
  shoe.add(m(new THREE.BoxGeometry(0.17, 0.1, 0.34), mat(SHOE), 0, 0, 0))
  shoe.add(sphere(0.085, mat(SHOE, SMOOTH), 0, -0.01, 0.16, 1, 0.6, 0.8, 12))
  shoe.add(m(new THREE.BoxGeometry(0.18, 0.03, 0.36), mat(SOLE), 0, -0.05, 0.01))
  shoe.add(m(new THREE.BoxGeometry(0.1, 0.01, 0.08), mat(0xf4f1ea), 0, 0.055, 0.02))
  return shoe
}

function mouthSpot(species: SpeciesDef): { y: number; z: number } {
  switch (species.snout) {
    case 'long':
      return { y: -0.19, z: 0.47 }
    case 'medium':
      return { y: -0.19, z: 0.41 }
    case 'short':
      return { y: -0.19, z: 0.37 }
    default:
      return { y: -0.21, z: 0.36 }
  }
}

/** Miệng: khi ngậm là nét cười cong, khi nói há thành khoang tối có lưỡi. Tọa độ cục bộ của đầu. */
function addMouth(head: THREE.Object3D, species: SpeciesDef): (open: number) => void {
  const { y, z } = mouthSpot(species)
  const mouthM = mat(MOUTH, SMOOTH)
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0075, 6, 14, Math.PI), mouthM)
  smile.position.set(0, y + 0.012, z)
  smile.rotation.z = Math.PI
  smile.castShadow = false
  head.add(smile)
  const mouth = sphere(0.05, mouthM, 0, y, z, 1, 0.18, 0.5, 14)
  mouth.castShadow = false
  mouth.visible = false
  const tongue = sphere(0.032, mat(TONGUE, SMOOTH), 0, -0.45, 0.15, 1, 0.5, 1, 10)
  tongue.castShadow = false
  mouth.add(tongue)
  head.add(mouth)
  if (species.buckTeeth) {
    const tooth = mat(0xfafafa, SMOOTH)
    head.add(m(new THREE.BoxGeometry(0.035, 0.07, 0.02), tooth, -0.02, y - 0.035, z + 0.02))
    head.add(m(new THREE.BoxGeometry(0.035, 0.07, 0.02), tooth, 0.02, y - 0.035, z + 0.02))
  }
  return (open) => {
    const k = THREE.MathUtils.clamp(open, 0, 1)
    const opened = k > 0.12
    smile.visible = !opened
    mouth.visible = opened
    mouth.scale.set(1 + k * 0.2, 0.18 + k * 1.2, 0.5 + k * 0.3)
  }
}

/**
 * Mắt: tròng trắng, mống mắt màu loài, con ngươi, điểm sáng, mí trên màu lông để chớp.
 * Mắt nhựa: hạt đen bóng, không mống, không mí (không chớp).
 */
function addEyes(
  head: THREE.Object3D,
  species: SpeciesDef,
  plastic: boolean,
  fur: THREE.Material,
): { eyes: THREE.Group[]; lids: THREE.Group[] } {
  const eyes: THREE.Group[] = []
  const lids: THREE.Group[] = []
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group()
    eye.position.set(sx * 0.14, 0.07, 0.3)
    eye.rotation.y = sx * 0.16
    eye.add(sphere(0.075, mat(0xffffff, SMOOTH), 0, 0, 0, 1, 1.1, 0.8, 16))
    if (plastic) {
      eye.add(sphere(0.06, mat(0x0a0a0a, SMOOTH), 0, 0, 0.03, 1, 1, 1, 14))
      eye.add(sphere(0.02, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9, flat: false }), 0.022, 0.026, 0.082, 1, 1, 1, 8))
    } else {
      eye.add(sphere(0.042, mat(species.eyeColor, SMOOTH), 0, 0, 0.045, 1, 1, 0.9, 14))
      eye.add(sphere(0.026, mat(0x111111, SMOOTH), 0, 0, 0.075, 1, 1, 0.8, 12))
      eye.add(sphere(0.011, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5, flat: false }), 0.016, 0.02, 0.094, 1, 1, 1, 8))
      const lidPivot = new THREE.Group()
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), fur)
      lid.scale.set(1.0, 1.1, 0.82)
      lid.castShadow = false
      lidPivot.add(lid)
      lidPivot.rotation.x = -0.6
      eye.add(lidPivot)
      lids.push(lidPivot)
    }
    head.add(eye)
    eyes.push(eye)
  }
  return { eyes, lids }
}


function addBrows(head: THREE.Object3D, furDark: THREE.Material): THREE.Group[] {
  const brows: THREE.Group[] = []
  for (const sx of [-1, 1]) {
    const brow = new THREE.Group()
    brow.position.set(sx * 0.14, 0.2, 0.285)
    const bar = capsule(0.02, 0.07, furDark)
    bar.rotation.z = sx * (-Math.PI / 2 + 0.2)
    brow.add(bar)
    head.add(brow)
    brows.push(brow)
  }
  return brows
}

function addBlush(head: THREE.Object3D): void {
  for (const sx of [-1, 1]) {
    const blush = m(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 14), mat(0xf29aa6, SMOOTH), sx * 0.21, -0.05, 0.29)
    blush.rotation.x = Math.PI / 2
    blush.rotation.z = sx * 0.6
    blush.castShadow = false
    head.add(blush)
  }
}

function addCheekTufts(head: THREE.Object3D, tuftM: THREE.Material): void {
  for (const sx of [-1, 1]) {
    const tuft = m(new THREE.ConeGeometry(0.075, 0.2, 10), tuftM, sx * 0.3, -0.07, 0.1)
    tuft.rotation.z = -sx * (Math.PI / 2)
    tuft.rotation.y = sx * 0.2
    head.add(tuft)
  }
}

function addHeadTuft(head: THREE.Object3D, fur: THREE.Material): void {
  for (const [tx, tz, rz] of [
    [0, 0.03, 0.1],
    [-0.07, 0.06, 0.45],
    [0.06, -0.01, -0.4],
  ]) {
    const tuft = m(new THREE.ConeGeometry(0.045, 0.12, 8), fur, tx, 0.36, tz)
    tuft.rotation.z = rz
    head.add(tuft)
  }
}

function addGlasses(head: THREE.Object3D): void {
  const frame = mat(0x1a1a1a, SMOOTH)
  for (const sx of [-1, 1]) {
    head.add(m(new THREE.TorusGeometry(0.085, 0.009, 6, 20), frame, sx * 0.14, 0.07, 0.37))
    const temple = m(new THREE.BoxGeometry(0.01, 0.01, 0.3), frame, sx * 0.3, 0.09, 0.2)
    temple.rotation.y = sx * 0.35
    head.add(temple)
  }
  head.add(m(new THREE.BoxGeometry(0.08, 0.01, 0.01), frame, 0, 0.075, 0.37))
}

function addGreyPatch(head: THREE.Object3D): void {
  head.add(sphere(0.15, mat(0xc9c9c9, SMOOTH), -0.22, 0.22, 0.08, 1, 0.6, 1, 14))
}

function addHeadAccessory(head: THREE.Object3D, look: CharacterLook): void {
  const accent = mat(look.accent, SMOOTH)
  const accentDark = mat(darken(look.accent, 0.6), SMOOTH)
  for (const acc of allAccessories(look)) {
    if (acc === 'hat') {
      const g = new THREE.Group()
      g.position.set(0, 0.3, 0)
      g.rotation.z = 0.1
      g.rotation.x = -0.08
      g.add(m(new THREE.CylinderGeometry(0.33, 0.33, 0.025, 24), accentDark, 0, 0, 0))
      g.add(m(new THREE.CylinderGeometry(0.21, 0.23, 0.18, 24), accentDark, 0, 0.1, 0))
      g.add(m(new THREE.CylinderGeometry(0.235, 0.235, 0.04, 24), accent, 0, 0.035, 0))
      head.add(g)
    } else if (acc === 'beret') {
      const g = new THREE.Group()
      g.position.set(0.05, 0.33, -0.02)
      g.rotation.z = 0.28
      g.add(sphere(0.3, accent, 0, 0, 0, 1, 0.42, 1, 20))
      g.add(m(new THREE.CylinderGeometry(0.24, 0.26, 0.05, 20), accentDark, 0, -0.04, 0))
      g.add(sphere(0.022, accentDark, 0, 0.13, 0, 1, 1, 1, 8))
      head.add(g)
    } else if (acc === 'shades') {
      // Kính đen: hai mắt kính tròn che trước mắt, cầu nối và gọng về sau tai
      const frame = mat(0x101010, SMOOTH)
      for (const sx of [-1, 1]) {
        const lens = m(new THREE.CylinderGeometry(0.078, 0.078, 0.008, 18), frame, sx * 0.14, 0.07, 0.385)
        lens.rotation.x = Math.PI / 2
        lens.rotation.z = sx * 0.16
        head.add(lens)
        const temple = m(new THREE.BoxGeometry(0.012, 0.012, 0.3), frame, sx * 0.3, 0.09, 0.2)
        temple.rotation.y = sx * 0.35
        head.add(temple)
      }
      head.add(m(new THREE.BoxGeometry(0.08, 0.012, 0.012), frame, 0, 0.08, 0.385))
    }
  }
}

/** Phụ kiện trên thân, tọa độ không gian thân; torsoScale co giãn áo và dây theo bề ngang thân loài. */
function addBodyAccessory(parent: THREE.Object3D, look: CharacterLook, torsoScale = 1): void {
  const accent = mat(look.accent, SMOOTH)
  const accentDark = mat(darken(look.accent, 0.7), SMOOTH)
  // Áo gi-lê và dây đeo bám theo thân nên co giãn quanh tâm thân; nơ, khăn ở cổ giữ nguyên
  const target = new THREE.Group()
  target.position.set(0, 1.0, 0)
  target.scale.set(torsoScale, 1, torsoScale)
  parent.add(target)
  const shift = (o: THREE.Object3D) => {
    o.position.y -= 1.0
    return o
  }
  for (const acc of allAccessories(look)) addOneBodyAccessory(acc, parent, target, shift, accent, accentDark)
}

function addOneBodyAccessory(
  acc: Accessory,
  parent: THREE.Object3D,
  target: THREE.Object3D,
  shift: (o: THREE.Object3D) => THREE.Object3D,
  accent: THREE.Material,
  accentDark: THREE.Material,
): void {
  switch (acc) {
    case 'coat': {
      // Áo khoác dài kín ngực, phủ qua hông, có cổ áo, thắt lưng và huy hiệu
      target.add(shift(sphere(0.33, accent, 0, 0.92, -0.02, 1.1, 1.55, 1.02, 24)))
      for (const sx of [-1, 1]) {
        const collar = m(new THREE.BoxGeometry(0.16, 0.06, 0.07), accentDark, sx * 0.12, 1.42, 0.2)
        collar.rotation.z = sx * -0.35
        collar.rotation.x = 0.3
        target.add(shift(collar))
      }
      const belt = m(new THREE.TorusGeometry(0.355, 0.025, 8, 28), accentDark, 0, 0.78, -0.02)
      belt.rotation.x = Math.PI / 2
      belt.scale.set(1, 1, 0.98)
      target.add(shift(belt))
      target.add(shift(m(new THREE.BoxGeometry(0.07, 0.06, 0.03), mat(0xd4af37, SMOOTH), 0, 0.78, 0.34)))
      target.add(shift(sphere(0.035, mat(0xd4af37, SMOOTH), -0.13, 1.2, 0.33, 1, 1, 0.5, 10)))
      break
    }
    case 'bowtie': {
      const g = new THREE.Group()
      g.position.set(0, 1.44, 0.24)
      for (const sx of [-1, 1]) {
        const wing = m(new THREE.BoxGeometry(0.09, 0.07, 0.03), accent, sx * 0.06, 0, 0)
        wing.rotation.z = sx * 0.12
        g.add(wing)
      }
      g.add(sphere(0.028, accentDark, 0, 0, 0.01, 1, 1, 1, 10))
      parent.add(g)
      break
    }
    case 'scarf': {
      const ring = m(new THREE.TorusGeometry(0.17, 0.06, 10, 20), accent, 0, 1.46, 0)
      ring.rotation.x = Math.PI / 2
      parent.add(ring)
      const tail = m(new THREE.BoxGeometry(0.1, 0.3, 0.04), accent, 0.12, 1.3, 0.26)
      tail.rotation.z = 0.1
      parent.add(tail)
      parent.add(m(new THREE.BoxGeometry(0.1, 0.05, 0.045), accentDark, 0.14, 1.14, 0.26))
      break
    }
    case 'sash': {
      // Dải băng chéo từ vai xuống hông, ôm theo thân, có huy hiệu trước ngực
      const band = m(new THREE.TorusGeometry(0.335, 0.03, 8, 36), accent, 0, 1.0, 0)
      band.scale.set(1, 1.22, 0.9)
      band.rotation.z = 0.95
      target.add(shift(band))
      const badge = sphere(0.035, mat(0xd4af37, SMOOTH), 0.11, 1.17, 0.29, 1, 1, 0.5, 10)
      target.add(shift(badge))
      break
    }
    case 'suspenders': {
      for (const sx of [-1, 1]) {
        const strap = m(new THREE.BoxGeometry(0.05, 0.6, 0.016), accent, sx * 0.13, 1.03, 0.285)
        strap.rotation.x = -0.12
        strap.rotation.z = sx * -0.08
        target.add(shift(strap))
      }
      const belt = m(new THREE.TorusGeometry(0.245, 0.02, 8, 24), accentDark, 0, 0.72, 0)
      belt.rotation.x = Math.PI / 2
      belt.scale.z = 0.9
      target.add(shift(belt))
      break
    }
    default:
      break
  }
  void parent
}

/** Manh mối: khóa kéo sau lưng, ba đoạn ôm theo lưng, có con trượt và khoen kéo. */
function addZipper(target: THREE.Object3D): void {
  const zip = mat(ZIPPER, SMOOTH)
  const metal = mat(0x8a8a8a, SMOOTH)
  const seg = (y: number, z: number, rx: number) => {
    const s = m(new THREE.BoxGeometry(0.035, 0.23, 0.02), zip, 0, y, z)
    s.rotation.x = rx
    target.add(s)
  }
  seg(1.0, -0.31, 0)
  seg(1.22, -0.265, 0.25)
  seg(0.78, -0.265, -0.25)
  target.add(m(new THREE.BoxGeometry(0.03, 0.07, 0.022), metal, 0, 1.31, -0.245))
  const pull = m(new THREE.TorusGeometry(0.02, 0.006, 6, 12), metal, 0, 1.25, -0.235)
  pull.rotation.y = Math.PI / 2
  target.add(pull)
}

function addBandage(target: THREE.Object3D, x = 0, y = 0, z = 0): void {
  target.add(m(new THREE.CylinderGeometry(0.1, 0.1, 0.11, 14), mat(0xf4f1ea, SMOOTH), x, y, z))
}

// ---------- Tai, đuôi procedural ----------

function buildEars(species: SpeciesDef, fur: THREE.Material, inner: THREE.Material): THREE.Group[] {
  const ears: THREE.Group[] = []
  for (const sx of [-1, 1]) {
    const g = new THREE.Group()
    switch (species.earShape) {
      case 'round':
        g.position.set(sx * 0.25, 0.3, 0)
        g.add(sphere(0.12, fur))
        g.add(sphere(0.07, inner, 0, 0, 0.06, 1, 1, 1, 12))
        break
      case 'pointed': {
        g.position.set(sx * 0.21, 0.33, -0.02)
        g.add(m(new THREE.ConeGeometry(0.11, 0.3, 12), fur, 0, 0.11, 0))
        g.add(m(new THREE.ConeGeometry(0.065, 0.2, 12), inner, 0, 0.09, 0.035))
        if (species.earTipColor !== undefined) {
          g.add(m(new THREE.ConeGeometry(0.05, 0.12, 12), mat(species.earTipColor, SMOOTH), 0, 0.21, 0))
        }
        g.rotation.z = -sx * 0.15
        break
      }
      case 'long':
        g.position.set(sx * 0.14, 0.38, -0.02)
        g.add(capsule(0.065, 0.46, fur, 0, 0.22, 0))
        g.add(capsule(0.035, 0.34, inner, 0, 0.22, 0.045))
        g.rotation.z = -sx * 0.12
        g.rotation.x = -0.1
        break
      case 'small':
        g.position.set(sx * 0.27, 0.25, 0)
        g.add(m(new THREE.ConeGeometry(0.08, 0.17, 10), fur, 0, 0.07, 0))
        g.add(m(new THREE.ConeGeometry(0.045, 0.1, 10), inner, 0, 0.06, 0.025))
        g.rotation.z = -sx * 0.5
        break
      case 'wide': {
        g.position.set(sx * 0.36, 0.17, 0)
        g.add(sphere(0.13, fur, 0, 0, 0, 1.4, 0.7, 0.4))
        g.add(sphere(0.09, inner, 0, 0, 0.03, 1.4, 0.7, 0.4))
        g.rotation.z = -sx * 0.6
        break
      }
    }
    ears.push(g)
  }
  return ears
}

function buildTail(species: SpeciesDef, fur: THREE.Material, belly: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  g.position.set(0, 0.66, -0.29)
  const dirBack = new THREE.Vector3(0, -0.59, -0.81)
  const tip = species.tailTipColor !== undefined ? mat(species.tailTipColor, SMOOTH) : belly
  switch (species.tailShape) {
    case 'stub':
      g.add(sphere(0.075, fur))
      break
    case 'bushy': {
      const t = capsule(0.1, 0.34, fur)
      t.position.copy(dirBack).multiplyScalar(0.18)
      t.rotation.x = -2.2
      g.add(t)
      const tp = sphere(0.095, tip)
      tp.position.copy(dirBack).multiplyScalar(0.37)
      g.add(tp)
      break
    }
    case 'puff':
      g.add(sphere(0.11, belly))
      break
    case 'short': {
      const t = m(new THREE.CylinderGeometry(0.02, 0.015, 0.24, 8), fur, 0, -0.09, -0.05)
      t.rotation.x = -0.4
      g.add(t)
      g.add(sphere(0.03, fur, 0, -0.2, -0.1))
      break
    }
    case 'long': {
      const t = capsule(0.055, 0.44, fur, 0, -0.2, -0.1)
      t.rotation.x = -0.35
      g.add(t)
      g.add(sphere(0.06, belly, 0, -0.43, -0.18))
      break
    }
    case 'flag': {
      g.add(sphere(0.075, tip, 0, 0, 0, 1, 1.2, 0.5))
      break
    }
  }
  return g
}

// ---------- Rig procedural (dự phòng khi thiếu model) ----------

function buildProcedural(
  species: SpeciesDef,
  clues: ReadonlySet<ClueId>,
  quirk: Quirk | null,
  furColor: number,
  look: CharacterLook,
): CharacterRig {
  const root = new THREE.Group()
  const body = new THREE.Group()
  body.scale.setScalar(species.height)
  root.add(body)

  const fur = mat(furColor, SMOOTH)
  const furDark = mat(darken(furColor, 0.7), SMOOTH)
  const belly = mat(species.bellyColor, SMOOTH)
  const snoutM = mat(species.snoutColor, SMOOTH)
  const maskM = species.maskColor !== undefined ? mat(species.maskColor, SMOOTH) : null
  const innerEar = species.earInnerColor !== undefined ? mat(species.earInnerColor, SMOOTH) : maskM ?? furDark

  // Chân (pivot ở hông)
  const legs: THREE.Group[] = []
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group()
    leg.position.set(sx * 0.15, 0.62, 0)
    leg.add(capsule(0.105, 0.2, fur, 0, -0.14, 0))
    leg.add(capsule(0.085, 0.18, fur, 0, -0.38, 0.01))
    if (clues.has('humanShoes')) {
      const shoe = buildShoe()
      shoe.position.set(0, -0.56, 0.06)
      leg.add(shoe)
    } else {
      leg.add(sphere(0.12, furDark, 0, -0.56, 0.05, 1, 0.5, 1.4))
      for (let i = -1; i <= 1; i++) leg.add(sphere(0.04, furDark, i * 0.07, -0.57, 0.2, 1, 0.8, 1, 10))
    }
    body.add(leg)
    legs.push(leg)
  }

  // Thân
  body.add(sphere(0.33, fur, 0, 1.0, 0, 1, 1.25, 0.9, 24))
  body.add(sphere(0.2, belly, 0, 0.98, 0.2, 1.0, 1.35, 0.5, 18))
  body.add(m(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 14), fur, 0, 1.46, 0))
  addBodyAccessory(body, look)

  // Tay (pivot ở vai)
  const arms: THREE.Group[] = []
  const fores: THREE.Group[] = []
  const hands: THREE.Group[] = []
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(sx * 0.36, 1.3, 0)
    arm.rotation.z = sx * -0.1
    arm.add(sphere(0.095, fur, 0, 0, 0, 1, 1, 1, 14))
    arm.add(capsule(0.085, 0.22, fur, 0, -0.17, 0))
    const fore = new THREE.Group()
    fore.position.set(0, -0.34, 0)
    fore.rotation.x = -0.4
    fore.add(sphere(0.08, fur, 0, 0, 0, 1, 1, 1, 12))
    fore.add(capsule(0.072, 0.2, fur, 0, -0.15, 0))
    const hand = new THREE.Group()
    hand.position.set(0, -0.33, 0)
    hand.scale.x = sx
    hand.add(clues.has('fiveFingers') ? buildHumanHand() : buildPaw(furDark))
    fore.add(hand)
    arm.add(fore)
    if (quirk === 'bandage' && sx === -1) addBandage(arm, 0, -0.17, 0)
    body.add(arm)
    arms.push(arm)
    fores.push(fore)
    hands.push(hand)
  }

  // Đầu
  const head = new THREE.Group()
  head.position.set(0, HEAD_Y, 0)
  body.add(head)
  head.add(sphere(0.36, fur, 0, 0, 0, 1, 0.94, 0.96, 28))
  if (maskM) head.add(sphere(0.25, maskM, 0, -0.1, 0.2, 1.0, 0.75, 0.6, 20))
  if (species.bandColor !== undefined) head.add(sphere(0.31, mat(species.bandColor, SMOOTH), 0, 0.07, 0.08, 1, 0.3, 0.95, 24))
  switch (species.snout) {
    case 'long':
      head.add(sphere(0.14, snoutM, 0, -0.1, 0.34, 1.0, 0.78, 1.4, 18))
      head.add(sphere(0.055, mat(species.noseColor, SMOOTH), 0, -0.05, 0.53, 1.2, 0.85, 0.8, 12))
      break
    case 'medium':
      head.add(sphere(0.15, snoutM, 0, -0.1, 0.3, 1.1, 0.82, 1.05, 18))
      head.add(sphere(0.055, mat(species.noseColor, SMOOTH), 0, -0.045, 0.45, 1.2, 0.85, 0.8, 12))
      break
    case 'short':
      head.add(sphere(0.16, snoutM, 0, -0.1, 0.28, 1.15, 0.8, 0.8, 18))
      head.add(sphere(0.055, mat(species.noseColor, SMOOTH), 0, -0.04, 0.4, 1.2, 0.85, 0.8, 12))
      break
    case 'flat': {
      head.add(sphere(0.14, snoutM, 0, -0.1, 0.3, 1.1, 0.7, 0.5, 18))
      const barrel = m(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 18), snoutM, 0, -0.08, 0.38)
      barrel.rotation.x = Math.PI / 2
      head.add(barrel)
      const disc = m(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 18), mat(species.noseColor, SMOOTH), 0, -0.08, 0.44)
      disc.rotation.x = Math.PI / 2
      head.add(disc)
      const nostril = mat(0x2a1a14, SMOOTH)
      head.add(sphere(0.018, nostril, -0.035, -0.08, 0.455, 1, 1, 1, 8), sphere(0.018, nostril, 0.035, -0.08, 0.455, 1, 1, 1, 8))
      break
    }
  }
  const setMouth = addMouth(head, species)
  const { eyes, lids } = addEyes(head, species, clues.has('plasticEyes'), fur)
  const brows = addBrows(head, furDark)
  if (species.cheeks === 'tufts') addCheekTufts(head, maskM ?? belly)
  else if (species.cheeks === 'blush') addBlush(head)
  const ears = buildEars(species, fur, innerEar)
  ears.forEach((e) => head.add(e))
  if (clues.has('earOff')) {
    const e = ears[1]
    e.rotation.z -= 0.7
    e.position.y -= 0.1
    e.position.x += 0.07
  }
  addHeadTuft(head, fur)
  addHeadAccessory(head, look)
  body.add(buildTail(species, fur, belly))

  if (species.tusks) {
    for (const sx of [-1, 1]) {
      const tusk = m(new THREE.ConeGeometry(0.028, 0.14, 8), mat(IVORY, SMOOTH), sx * 0.11, -0.16, 0.4)
      tusk.rotation.x = 0.5
      tusk.rotation.z = -sx * 0.35
      head.add(tusk)
    }
  }
  if (species.antlers) {
    const antler = mat(0xa98b6a, SMOOTH)
    for (const sx of [-1, 1]) {
      const main = m(new THREE.CylinderGeometry(0.022, 0.028, 0.46, 8), antler, sx * 0.2, 0.5, -0.04)
      main.rotation.z = -sx * 0.45
      head.add(main)
      const b1 = m(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 8), antler, sx * 0.33, 0.66, -0.04)
      b1.rotation.z = -sx * 1.1
      head.add(b1)
      const b2 = m(new THREE.CylinderGeometry(0.013, 0.017, 0.18, 8), antler, sx * 0.22, 0.68, 0.02)
      b2.rotation.z = sx * 0.3
      head.add(b2)
    }
  }
  if (species.spots) {
    const pts: [number, number, number][] = [
      [-0.12, 1.18, -0.26],
      [0.1, 1.08, -0.27],
      [-0.05, 0.92, -0.28],
      [0.17, 1.22, -0.24],
      [-0.19, 0.98, -0.25],
      [0.08, 0.8, -0.26],
      [-0.22, 1.2, 0.0],
      [0.24, 1.05, -0.05],
    ]
    for (const [x, y, z] of pts) body.add(sphere(0.045, belly, x, y, z, 1, 1, 0.5, 10))
  }
  if (clues.has('zipper')) addZipper(body)
  if (quirk === 'glasses') addGlasses(head)
  if (quirk === 'greyPatch') addGreyPatch(head)

  let idleT = rand(0, 10)
  let walkT = 0
  let gestureLeft = 0
  let glass: THREE.Group | null = null
  const s = species.height
  const face = new Face(brows, lids, eyes)
  return {
    root,
    body,
    head,
    eyes,
    ears,
    hands,
    brows,
    setMouth,
    setBlink: (k) => face.setBlink(k),
    setMood: (mood) => face.setMood(mood),
    playOnce: (name) => {
      // Tay phải là arms[0] (phía -x). Vẫy: giơ ngang ra ngoài rồi lắc; uống: đưa tay lên miệng.
      const arm = arms[0]
      const fore = fores[0]
      const duration = name === 'Wave' ? 1.4 : 1.6
      gestureLeft = duration
      tweens.add({
        duration,
        ease: Easing.inOutQuad,
        onUpdate: (t) => {
          const k = Math.sin(Math.PI * t)
          if (name === 'Wave') {
            arm.rotation.z = -2.3 * k
            fore.rotation.z = Math.sin(t * Math.PI * 4) * 0.5 * k
          } else {
            arm.rotation.x = 1.2 * k
            fore.rotation.x = -0.4 - 1.9 * k
            head.rotation.x = -0.25 * k
          }
        },
        onComplete: () => {
          arm.rotation.z = 0.1
          fore.rotation.z = 0
          fore.rotation.x = -0.4
        },
      })
      return duration
    },
    holdGlass: (color) => {
      if (glass) head.remove(glass)
      glass = buildGlass(color)
      glass.position.set(-0.07, -0.3, 0.4)
      glass.rotation.set(-0.5, 0, 0.45)
      head.add(glass)
    },
    releaseGlass: () => {
      if (glass) {
        head.remove(glass)
        disposeTree(glass)
        glass = null
      }
    },
    update: (dt, moving, talking, look) => {
      idleT += dt
      gestureLeft = Math.max(0, gestureLeft - dt)
      if (moving) {
        walkT += dt * 9
        const swing = Math.sin(walkT)
        legs[0].rotation.x = swing * 0.6
        legs[1].rotation.x = -swing * 0.6
        arms[0].rotation.x = -swing * 0.5
        arms[1].rotation.x = swing * 0.5
      } else if (gestureLeft <= 0) {
        const sway = Math.sin(idleT * 1.3) * 0.04
        for (const leg of legs) leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 8, dt)
        arms[0].rotation.x = THREE.MathUtils.damp(arms[0].rotation.x, sway, 8, dt)
        arms[1].rotation.x = THREE.MathUtils.damp(arms[1].rotation.x, -sway, 8, dt)
      }
      body.scale.set(s, s * (1 + Math.sin(idleT * 2.2) * 0.012), s)
      if (gestureLeft <= 0) {
        head.rotation.x = Math.sin(idleT * 0.7) * 0.03 + (talking ? Math.sin(idleT * 11) * 0.04 : 0) + (look?.pitch ?? 0)
      }
      head.rotation.y = look?.yaw ?? 0
      setMouth(talking ? Math.abs(Math.sin(idleT * 22)) * 0.8 : face.mouthBase)
    },
    baseScale: species.height,
    furColor,
    fromModel: false,
    dispose: () => disposeTree(root),
  }
}

// ---------- Rig từ model Blender ----------

function toonFromGltf(name: string, src: THREE.Material, furColor: number): THREE.Material {
  if (name === 'Fur') return mat(furColor, SMOOTH)
  if (name === 'FurDark') return mat(darken(furColor, 0.7), SMOOTH)
  const color = (src as THREE.MeshStandardMaterial).color
  return mat(color ? color.getHex() : 0x888888, SMOOTH)
}

function buildFromModel(
  species: SpeciesDef,
  clues: ReadonlySet<ClueId>,
  quirk: Quirk | null,
  furColor: number,
  look: CharacterLook,
  inst: ModelInstance,
): CharacterRig {
  const root = new THREE.Group()
  const body = new THREE.Group()
  body.scale.setScalar(species.height)
  root.add(body)
  body.add(inst.root)

  // Đổi vật liệu glTF sang toon; lông theo màu của khách (manh mối màu lông sai).
  // Thân có mặt nạ vertex color -> vật liệu trộn vùng bụng / mặt / mõm mượt.
  inst.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const src = mesh.material as THREE.Material
    const attrs = mesh.geometry.attributes
    mesh.material = attrs.color ? bodyMaterial(furColor, species, !!attrs._ao) : toonFromGltf(src.name, src, furColor)
    mesh.castShadow = true
    mesh.receiveShadow = false
  })

  const bone = (name: string): THREE.Object3D | null => inst.root.getObjectByName(name) ?? null
  const fur = mat(furColor, SMOOTH)
  const furDark = mat(darken(furColor, 0.7), SMOOTH)
  const extras: THREE.Object3D[] = []
  root.updateMatrixWorld(true)

  /** Nhóm gắn vào xương nhưng đặt bằng tọa độ không gian thân (giữ nguyên hệ tọa độ của bản procedural). */
  const anchor = (boneName: string, x: number, y: number, z: number, mirrorX = 1): THREE.Group => {
    const a = new THREE.Group()
    a.position.set(x, y, z)
    a.scale.x = mirrorX
    body.add(a)
    a.updateMatrixWorld(true)
    bone(boneName)?.attach(a)
    extras.push(a)
    return a
  }

  const head = anchor('Head', 0, HEAD_Y, 0)
  const setMouth = addMouth(head, species)
  const { eyes, lids } = addEyes(head, species, clues.has('plasticEyes'), fur)
  const brows = addBrows(head, furDark)
  if (species.cheeks === 'blush') addBlush(head)
  addHeadAccessory(head, look)
  if (quirk === 'glasses') addGlasses(head)
  if (quirk === 'greyPatch') addGreyPatch(head)

  const chest = anchor('Chest', 0, 0, 0)
  addBodyAccessory(chest, look, species.torsoScale)
  if (clues.has('zipper')) addZipper(anchor('Spine', 0, 0, 0))
  const armX = modelArmX(species)
  if (quirk === 'bandage') addBandage(anchor('UpperArm.R', -armX.upper, 1.13, 0))

  const hands: THREE.Object3D[] = []
  for (const sx of [-1, 1]) {
    const side = sx > 0 ? 'L' : 'R'
    const paw = bone('Paw.' + side)
    if (clues.has('fiveFingers')) {
      if (paw) paw.visible = false
      const a = anchor('Hand.' + side, sx * armX.wrist, 0.66, 0.125, sx)
      a.add(buildHumanHand())
      hands.push(a)
    } else if (paw) {
      hands.push(paw)
    }
    if (clues.has('humanShoes')) {
      const footMesh = bone('FootMesh.' + side)
      if (footMesh) footMesh.visible = false
      anchor('Foot.' + side, sx * 0.15, 0.06, 0.06).add(buildShoe())
    }
  }

  // Tai: xương Ear.R (−x) và Ear.L (+x); manh mối tai lệch xoay xương bên +x như bản procedural
  const ears = [bone('Ear.R'), bone('Ear.L')].filter((e): e is THREE.Object3D => e !== null)
  if (clues.has('earOff') && ears.length === 2) {
    ears[1].rotation.z -= 0.7
    ears[1].position.y -= 0.08
  }

  // Animation từ Blender: Idle / Walk / Talk trộn theo trạng thái
  const mixer = new THREE.AnimationMixer(inst.root)
  const action = (name: string): THREE.AnimationAction | null => {
    const clip = THREE.AnimationClip.findByName(inst.clips, name)
    if (!clip) return null
    const a = mixer.clipAction(clip)
    a.play()
    return a
  }
  const idle = action('Idle')
  const walk = action('Walk')
  const talk = action('Talk')
  walk?.setEffectiveWeight(0)
  talk?.setEffectiveWeight(0)
  if (idle) idle.time = rand(0, 3)
  const headBone = bone('Head')
  const oneShots = new Map<string, THREE.AnimationAction>()
  let gestureLeft = 0
  let glass: THREE.Group | null = null
  // Ly đặt trước miệng trong lúc uống (theo đầu), tay nâng lên che bớt phần đáy
  const glassAnchor = new THREE.Group()
  glassAnchor.position.set(-0.07, -0.3, 0.4)
  glassAnchor.rotation.set(-0.5, 0, 0.45)
  head.add(glassAnchor)
  let walkW = 0
  let talkW = 0
  let t = 0
  const face = new Face(brows, lids, eyes)

  return {
    root,
    body,
    head: headBone ?? head,
    eyes,
    ears,
    hands,
    brows,
    setMouth,
    setBlink: (k) => face.setBlink(k),
    setMood: (mood) => face.setMood(mood),
    playOnce: (name) => {
      const clip = THREE.AnimationClip.findByName(inst.clips, name)
      if (!clip) return 0.8
      let a = oneShots.get(name)
      if (!a) {
        a = mixer.clipAction(clip)
        a.setLoop(THREE.LoopOnce, 1)
        a.clampWhenFinished = false
        oneShots.set(name, a)
      }
      a.reset()
      a.setEffectiveWeight(1)
      a.play()
      gestureLeft = clip.duration
      return clip.duration
    },
    holdGlass: (color) => {
      if (glass) glassAnchor.remove(glass)
      glass = buildGlass(color)
      glassAnchor.add(glass)
    },
    releaseGlass: () => {
      if (glass) {
        glassAnchor.remove(glass)
        disposeTree(glass)
        glass = null
      }
    },
    update: (dt, moving, talking, look) => {
      walkW = THREE.MathUtils.damp(walkW, moving ? 1 : 0, 10, dt)
      talkW = THREE.MathUtils.damp(talkW, talking ? 1 : 0, 12, dt)
      gestureLeft = Math.max(0, gestureLeft - dt)
      // Khi đang vẫy / uống, hạ trọng số Idle để cử chỉ không bị trộn loãng
      const gesture = gestureLeft > 0 ? 0.15 : 1
      idle?.setEffectiveWeight((1 - walkW * 0.85) * gesture)
      walk?.setEffectiveWeight(walkW)
      talk?.setEffectiveWeight(talkW * gesture)
      t += dt
      setMouth(talking ? Math.abs(Math.sin(t * 22)) * 0.8 : face.mouthBase)
      mixer.update(dt)
      // Sau khi clip đặt tư thế, cộng thêm hướng nhìn về người chơi lên xương đầu
      if (headBone && look) {
        headBone.rotation.y += look.yaw
        headBone.rotation.x += look.pitch
      }
    },
    baseScale: species.height,
    furColor,
    fromModel: true,
    dispose: () => {
      mixer.stopAllAction()
      // Lưới của model dùng chung geometry với bản gốc, chỉ dọn các phần gắn thêm
      for (const e of extras) disposeTree(e)
    },
  }
}

export function buildCharacter(
  species: SpeciesDef,
  clues: ReadonlySet<ClueId>,
  quirk: Quirk | null,
  furColor: number,
  look: CharacterLook = DEFAULT_LOOK,
): CharacterRig {
  if (hasModel(species.id)) {
    const inst = instantiateModel(species.id)
    if (inst) return buildFromModel(species, clues, quirk, furColor, look, inst)
  }
  return buildProcedural(species, clues, quirk, furColor, look)
}

/** Người bên trong costume, hiện ra khi bắn đúng: xanh xao, áo rách. */
export function buildHumanReveal(): THREE.Group {
  const g = new THREE.Group()
  const skin = mat(0xd6c3b0, SMOOTH)
  const shirt = mat(0x5d5d5d)
  const shirtTorn = mat(0x4a4a4a)
  const pants = mat(0x3b4a6b, SMOOTH)
  for (const sx of [-1, 1]) {
    g.add(capsule(0.08, 0.62, pants, sx * 0.12, 0.42, 0))
    g.add(m(new THREE.BoxGeometry(0.16, 0.08, 0.3), mat(SHOE), sx * 0.12, 0.04, 0.05))
    const arm = capsule(0.06, 0.5, skin, sx * 0.3, 1.05, 0)
    arm.rotation.z = sx * -0.1
    g.add(arm)
  }
  g.add(m(new THREE.BoxGeometry(0.42, 0.55, 0.24), shirt, 0, 1.08, 0))
  g.add(m(new THREE.BoxGeometry(0.2, 0.18, 0.26), shirtTorn, 0.08, 0.9, 0))
  g.add(sphere(0.17, skin, 0, 1.55, 0, 1, 1.05, 1, 18))
  const hairM = mat(0x2a1e14, SMOOTH)
  g.add(sphere(0.18, hairM, 0, 1.63, -0.02, 1, 0.6, 1, 14))
  g.add(sphere(0.06, hairM, 0.12, 1.7, 0.05, 1, 1.4, 1, 10))
  g.add(sphere(0.05, hairM, -0.1, 1.72, 0.02, 1, 1.3, 1, 10))
  const shadow = mat(0x6b5a66, SMOOTH)
  for (const sx of [-1, 1]) {
    g.add(sphere(0.035, shadow, sx * 0.06, 1.55, 0.15, 1, 0.7, 0.5, 10))
    g.add(sphere(0.02, mat(0x111111, SMOOTH), sx * 0.06, 1.57, 0.165, 1, 1, 1, 8))
  }
  return g
}
