import * as THREE from 'three'

/**
 * Layer cho vật thể không vẽ viền toon (kính cửa sổ, vòm trời...).
 * Camera chính phải bật layer này; pass pháp tuyến trong PostFX sẽ tắt nó.
 */
export const NO_OUTLINE_LAYER = 1

interface MatOpts {
  emissive?: number
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  side?: THREE.Side
  /** Mặc định true: tô phẳng từng mặt (đồ vật). Nhân vật dùng false cho khối tròn mượt. */
  flat?: boolean
  /** Dải sáng mềm cho bề mặt lớn (tường, trần, sàn) để đèn điểm không tạo cung sáng gắt. */
  soft?: boolean
}

let gradient: THREE.DataTexture | null = null
let softGradientTex: THREE.DataTexture | null = null

function makeGradient(f: (dotNL: number) => number): THREE.DataTexture {
  const n = 64
  const data = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const dotNL = ((i + 0.5) / n) * 2 - 1
    data[i] = Math.round(THREE.MathUtils.clamp(f(dotNL), 0, 1) * 255)
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RedFormat, THREE.UnsignedByteType)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** Dải sáng gần Lambert, chỉ hơi nâng vùng tối: dùng cho mặt phẳng lớn. */
export function softGradient(): THREE.DataTexture {
  if (!softGradientTex) softGradientTex = makeGradient((d) => THREE.MathUtils.smoothstep(d, -0.05, 0.9))
  return softGradientTex
}

/**
 * Dải sáng toon 3 bậc: tối (không có sáng trực tiếp), trung, sáng.
 * Chuyển bậc có độ mềm nhỏ để đường ranh trên khối tròn không bị răng cưa.
 */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = makeGradient(
      (d) => 0.62 * THREE.MathUtils.smoothstep(d, -0.02, 0.08) + 0.38 * THREE.MathUtils.smoothstep(d, 0.4, 0.5),
    )
  }
  return gradient
}

/** MeshToonMaterial không khai báo flatShading trong kiểu nhưng shader vẫn đọc cờ này. */
function setFlat(m: THREE.Material, flat: boolean): void {
  ;(m as THREE.Material & { flatShading: boolean }).flatShading = flat
}

const cache = new Map<string, THREE.MeshToonMaterial>()

/** Vật liệu toon màu phẳng dùng chung, cache theo tham số. */
export function mat(color: number, o: MatOpts = {}): THREE.MeshToonMaterial {
  const key = [
    color,
    o.emissive ?? 0,
    o.emissiveIntensity ?? 1,
    o.transparent ? 1 : 0,
    o.opacity ?? 1,
    o.side ?? THREE.FrontSide,
    o.flat === false ? 0 : 1,
    o.soft ? 1 : 0,
  ].join('|')
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: o.soft ? softGradient() : toonGradient(),
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    })
    setFlat(m, o.flat !== false)
    cache.set(key, m)
  }
  return m
}

/** Vật liệu toon có texture (sàn, poster, bảng menu). Không cache. */
export function texMat(map: THREE.Texture, o: MatOpts = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    map,
    gradientMap: o.soft ? softGradient() : toonGradient(),
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
  })
  setFlat(m, o.flat !== false)
  return m
}

/** Vật liệu phát sáng riêng (bóng đèn, dải đèn kệ) để Lighting chỉnh emissiveIntensity theo giờ. */
export function glowMat(color: number, emissive: number, intensity = 0.4): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: intensity, gradientMap: toonGradient() })
  setFlat(m, false)
  return m
}

export function darken(color: number, f: number): number {
  return new THREE.Color(color).multiplyScalar(f).getHex()
}

export function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}

export function placed(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Vẽ canvas rồi trả về texture (dùng cho poster, bảng menu, mặt đồng hồ, sàn gỗ). */
export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
  })
}
