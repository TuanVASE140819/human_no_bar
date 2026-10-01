import * as THREE from 'three'

/** Một nguồn sáng trong quán: đèn treo, đèn tường. Bar dựng vỏ đèn, Lighting quản lý cường độ. */
export interface LampSpec {
  position: THREE.Vector3
  /** Vật liệu phát sáng (bóng, chụp trong) chỉnh theo giờ */
  bulbs: THREE.MeshToonMaterial[]
  intensity: number
  distance: number
  /** Phần cường độ giữ lại ban ngày (0..1) */
  dayLevel: number
}

/**
 * Ánh sáng ngày: mặt trời qua cửa sổ trái chuyển dần sang hoàng hôn, đèn trong quán sáng dần lúc chiều.
 * Vòm trời gradient và sương mù xa thay cho background phẳng.
 */
export class Lighting {
  readonly hemi: THREE.HemisphereLight
  readonly ambient: THREE.AmbientLight
  readonly sun: THREE.DirectionalLight

  private readonly lamps: { light: THREE.PointLight; spec: LampSpec }[] = []
  private readonly skyMat: THREE.ShaderMaterial
  private readonly fog: THREE.Fog

  private readonly skyTopDay = new THREE.Color(0x5ea3e6)
  private readonly skyTopDusk = new THREE.Color(0x3a2f6b)
  private readonly horizonDay = new THREE.Color(0xdcedf6)
  private readonly horizonDusk = new THREE.Color(0xf5a35e)
  private readonly sunDay = new THREE.Color(0xfff1dc)
  private readonly sunDusk = new THREE.Color(0xff9a4a)
  private readonly hemiSkyDay = new THREE.Color(0xdcefff)
  private readonly hemiSkyDusk = new THREE.Color(0x8d6fa8)

  constructor(private readonly scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xdcefff, 0xb08a5e, 0.7)
    scene.add(this.hemi)

    this.ambient = new THREE.AmbientLight(0xffe2c4, 0.55)
    scene.add(this.ambient)

    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const cam = this.sun.shadow.camera
    cam.left = -10
    cam.right = 10
    cam.top = 10
    cam.bottom = -10
    cam.near = 0.5
    cam.far = 60
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    scene.add(this.sun)
    scene.add(this.sun.target)

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: this.skyTopDay.clone() },
        horizonColor: { value: this.horizonDay.clone() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: this.sunDay.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          float s = max(dot(dir, sunDir), 0.0);
          col += sunColor * (pow(s, 300.0) * 1.6 + pow(s, 6.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), this.skyMat)
    sky.frustumCulled = false
    scene.add(sky)
    scene.background = null

    this.fog = new THREE.Fog(this.horizonDay.clone(), 18, 75)
    scene.fog = this.fog

    this.update(0)
  }

  addLamp(spec: LampSpec): THREE.PointLight {
    const l = new THREE.PointLight(0xffd27f, 0, spec.distance, 2)
    l.position.copy(spec.position)
    this.scene.add(l)
    this.lamps.push({ light: l, spec })
    return l
  }

  /** progress 0 = 10:00 sáng, 1 = 18:00 chiều */
  update(progress: number): void {
    const p = THREE.MathUtils.clamp(progress, 0, 1)
    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(55, 9, p))
    const azim = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-125, -70, p))
    const r = 30
    this.sun.position.set(
      Math.cos(elev) * Math.sin(azim) * r,
      Math.sin(elev) * r,
      Math.cos(elev) * Math.cos(azim) * r,
    )
    this.sun.color.lerpColors(this.sunDay, this.sunDusk, p)
    this.sun.intensity = THREE.MathUtils.lerp(2.6, 1.3, p)
    this.hemi.color.lerpColors(this.hemiSkyDay, this.hemiSkyDusk, p)
    this.hemi.intensity = THREE.MathUtils.lerp(0.7, 0.35, p)
    this.ambient.intensity = THREE.MathUtils.lerp(0.55, 0.42, p)

    const u = this.skyMat.uniforms
    ;(u.topColor.value as THREE.Color).lerpColors(this.skyTopDay, this.skyTopDusk, p)
    ;(u.horizonColor.value as THREE.Color).lerpColors(this.horizonDay, this.horizonDusk, p)
    ;(u.sunColor.value as THREE.Color).copy(this.sun.color)
    ;(u.sunDir.value as THREE.Vector3).copy(this.sun.position).normalize()
    this.fog.color.copy(u.horizonColor.value as THREE.Color)

    const lampOn = THREE.MathUtils.smoothstep(p, 0.45, 0.8)
    for (const { light, spec } of this.lamps) {
      light.intensity = spec.intensity * THREE.MathUtils.lerp(spec.dayLevel, 1, lampOn)
      for (const b of spec.bulbs) b.emissiveIntensity = 0.35 + lampOn * 1.3
    }
  }
}
