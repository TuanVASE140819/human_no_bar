// Tìm blender.exe rồi chạy build_characters.py ở chế độ nền.
// Dùng: npm run assets            (tất cả loài)
//       npm run assets -- fox deer (chỉ vài loài)
// Đặt biến môi trường BLENDER để trỏ tới blender.exe khác.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const project = resolve(here, '..', '..')

function findBlender() {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER
  const roots = [
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Blender'),
    'C:\\Program Files\\Blender Foundation',
    'C:\\Program Files\\Blender Foundation\\Blender',
  ]
  const found = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const exe = join(root, entry.name, 'blender.exe')
      if (existsSync(exe)) found.push(exe)
    }
    const direct = join(root, 'blender.exe')
    if (existsSync(direct)) found.push(direct)
  }
  found.sort()
  return found.at(-1) ?? null
}

const blender = findBlender()
if (!blender) {
  console.error('Không tìm thấy blender.exe. Cài Blender hoặc đặt biến môi trường BLENDER.')
  process.exit(1)
}
const outDir = join(project, 'public', 'models')
const script = join(here, 'build_characters.py')
const extra = process.argv.slice(2)
console.log(`Blender: ${blender}`)
console.log(`Xuất glTF vào: ${outDir}`)
const r = spawnSync(blender, ['-b', '--factory-startup', '--python', script, '--', outDir, ...extra], {
  stdio: 'inherit',
  cwd: project,
})
process.exit(r.status ?? 1)
