import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { NO_OUTLINE_LAYER } from './materials'

/**
 * Viền toon dò theo độ sâu + pháp tuyến, cộng vignette và nhiễu hạt (dùng cho đêm).
 * Chạy trong không gian tuyến tính HDR; OutputPass phía sau lo tone mapping và sRGB.
 */
const ToonEdgeShader = {
  name: 'ToonEdgeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tNormal: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.05 },
    cameraFar: { value: 120 },
    lineWidth: { value: 1 },
    outlineColor: { value: new THREE.Color(0x140c06) },
    outlineStrength: { value: 0.9 },
    fadeNear: { value: 14 },
    fadeFar: { value: 40 },
    vignette: { value: 0.32 },
    grain: { value: 0 },
    time: { value: 0 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float lineWidth;
    uniform vec3 outlineColor;
    uniform float outlineStrength;
    uniform float fadeNear;
    uniform float fadeFar;
    uniform float vignette;
    uniform float grain;
    uniform float time;
    uniform vec3 tint;
    varying vec2 vUv;

    float viewDist(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(z, cameraNear, cameraFar);
    }
    vec3 viewNormal(vec2 uv) {
      return texture2D(tNormal, uv).rgb * 2.0 - 1.0;
    }
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      vec2 px = lineWidth / resolution;
      float d0 = viewDist(vUv);
      vec3 n0 = viewNormal(vUv);

      // Bề mặt nghiêng so với camera (sàn xa, tường dọc) có độ sâu đổi nhanh: nới ngưỡng để không vẽ vệt giả.
      float slope = 1.0 - clamp(abs(n0.z), 0.0, 1.0);
      float threshold = 0.02 + 0.3 * slope * slope;

      float depthEdge = 0.0;
      float normalEdge = 0.0;
      vec2 offs[4];
      offs[0] = vec2(px.x, 0.0);
      offs[1] = vec2(-px.x, 0.0);
      offs[2] = vec2(0.0, px.y);
      offs[3] = vec2(0.0, -px.y);
      for (int i = 0; i < 4; i++) {
        vec2 uv = vUv + offs[i];
        // Chỉ xét hàng xóm xa hơn: viền nằm trên mép vật ở gần, không tràn ra nền.
        float rel = (viewDist(uv) - d0) / d0;
        depthEdge = max(depthEdge, rel);
        normalEdge = max(normalEdge, 1.0 - dot(viewNormal(uv), n0));
      }
      float eD = smoothstep(threshold, threshold * 2.0, depthEdge);
      float eN = smoothstep(0.4, 0.7, normalEdge);
      float edge = max(eD, eN) * outlineStrength;
      edge *= 1.0 - smoothstep(fadeNear, fadeFar, d0);
      col.rgb = mix(col.rgb, outlineColor, edge);

      vec2 q = vUv - 0.5;
      float v = 1.0 - vignette * smoothstep(0.35, 1.0, dot(q, q) * 2.2);
      col.rgb *= v * tint;

      if (grain > 0.0) {
        float g = hash(vUv * resolution + fract(time) * 977.0) - 0.5;
        col.rgb += g * grain;
      }
      gl_FragColor = col;
    }
  `,
}

export class PostFX {
  /** Tắt toàn bộ hậu kỳ (máy yếu): render thẳng ra màn hình. */
  enabled = true

  private readonly composer: EffectComposer
  private readonly edgePass: ShaderPass
  private readonly normalRT: THREE.WebGLRenderTarget
  private readonly normalMat = new THREE.MeshNormalMaterial()
  private readonly normalClear = new THREE.Color(0.5, 0.5, 1.0)
  private readonly savedClear = new THREE.Color()
  private time = 0

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    const pr = renderer.getPixelRatio()
    const size = renderer.getSize(new THREE.Vector2())
    const w = Math.max(1, Math.floor(size.x * pr))
    const h = Math.max(1, Math.floor(size.y * pr))

    // Safari cũ không render được vào bộ đệm half-float: lùi về 8 bit để không bị màn hình đen
    const halfFloatOk =
      renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')
    const colorRT = new THREE.WebGLRenderTarget(w, h, {
      type: halfFloatOk ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: 4,
    })
    this.composer = new EffectComposer(renderer, colorRT)
    this.composer.setPixelRatio(pr)
    this.composer.setSize(size.x, size.y)

    const depth = new THREE.DepthTexture(w, h)
    depth.type = THREE.UnsignedIntType
    this.normalRT = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: depth,
    })

    this.edgePass = new ShaderPass(ToonEdgeShader)
    const u = this.edgePass.uniforms
    u.tNormal.value = this.normalRT.texture
    u.tDepth.value = depth
    u.resolution.value.set(w, h)
    u.cameraNear.value = camera.near
    u.cameraFar.value = camera.far
    u.lineWidth.value = Math.max(1, pr)

    this.composer.addPass(new RenderPass(scene, camera))
    this.composer.addPass(this.edgePass)
    this.composer.addPass(new OutputPass())

    // Shadow map chỉ cập nhật một lần mỗi khung (ở pass màu), không lặp lại ở pass pháp tuyến.
    renderer.shadowMap.autoUpdate = false
  }

  /** Nhiễu hạt và tông màu, dùng cho đêm hoặc cúp điện. */
  setMood(grain: number, tint: number): void {
    this.edgePass.uniforms.grain.value = grain
    this.edgePass.uniforms.tint.value.set(tint)
  }

  setSize(width: number, height: number): void {
    const pr = this.renderer.getPixelRatio()
    const w = Math.max(1, Math.floor(width * pr))
    const h = Math.max(1, Math.floor(height * pr))
    this.composer.setPixelRatio(pr)
    this.composer.setSize(width, height)
    this.normalRT.setSize(w, h)
    this.edgePass.uniforms.resolution.value.set(w, h)
    this.edgePass.uniforms.lineWidth.value = Math.max(1, pr)
  }

  render(dt: number): void {
    this.time += dt
    this.renderer.shadowMap.needsUpdate = true
    if (!this.enabled) {
      this.renderer.setRenderTarget(null)
      this.renderer.render(this.scene, this.camera)
      return
    }

    // Pass 1: pháp tuyến + độ sâu (bỏ qua các vật trên layer không viền).
    const bg = this.scene.background
    this.renderer.getClearColor(this.savedClear)
    const savedAlpha = this.renderer.getClearAlpha()
    const shadowUpdate = this.renderer.shadowMap.needsUpdate
    this.renderer.shadowMap.needsUpdate = false
    this.scene.background = null
    this.scene.overrideMaterial = this.normalMat
    this.camera.layers.disable(NO_OUTLINE_LAYER)
    this.renderer.setClearColor(this.normalClear, 1)
    this.renderer.setRenderTarget(this.normalRT)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    this.camera.layers.enable(NO_OUTLINE_LAYER)
    this.scene.overrideMaterial = null
    this.scene.background = bg
    this.renderer.setClearColor(this.savedClear, savedAlpha)
    this.renderer.shadowMap.needsUpdate = shadowUpdate

    // Pass 2: màu → viền → tone mapping ra màn hình.
    this.edgePass.uniforms.time.value = this.time
    this.composer.render(dt)
  }
}
