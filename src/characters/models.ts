import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { SPECIES_IDS, type SpeciesId } from '@/data/species'

interface ModelEntry {
  scene: THREE.Group
  clips: THREE.AnimationClip[]
}

export interface ModelInstance {
  root: THREE.Object3D
  clips: THREE.AnimationClip[]
}

const models = new Map<SpeciesId, ModelEntry>()

/** Tải model glTF do Blender xuất (public/models/<loài>.glb). Loài nào thiếu sẽ dùng nhân vật procedural. */
export async function loadCharacterModels(base = `${import.meta.env.BASE_URL}models/`): Promise<number> {
  const loader = new GLTFLoader()
  await Promise.all(
    SPECIES_IDS.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(`${base}${id}.glb`)
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) {
            mesh.castShadow = true
            mesh.frustumCulled = false
          }
        })
        models.set(id, { scene: gltf.scene, clips: gltf.animations })
      } catch (err) {
        console.warn(`Không tải được model ${id}, dùng nhân vật procedural.`, err)
      }
    }),
  )
  return models.size
}

export function hasModel(id: SpeciesId): boolean {
  return models.has(id)
}

/** Bản sao riêng (xương riêng) để nhiều khách cùng loài đứng trong cảnh. */
export function instantiateModel(id: SpeciesId): ModelInstance | null {
  const entry = models.get(id)
  if (!entry) return null
  return { root: cloneSkeleton(entry.scene), clips: entry.clips }
}
