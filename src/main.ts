import './style.css'
import { Game } from '@/core/Game'
import { loadCharacterModels } from '@/characters/models'

const canvas = document.getElementById('game') as HTMLCanvasElement | null
if (!canvas) throw new Error('Thiếu <canvas id="game">')

const params = new URLSearchParams(location.search)

function start(): void {
  const game = new Game(canvas as HTMLCanvasElement)
  ;(window as unknown as { __game: Game }).__game = game
  if (params.has('lineup')) {
    game.debugLineup()
  } else if (params.has('debug')) {
    // ?debug bỏ qua menu; thêm &intro để vẫn có cảnh đặc vụ mở đầu
    game.debugStart(params.has('intro'))
  }
}

// Màn chờ tải model nhân vật (public/models/*.glb do Blender xuất). Thiếu model thì dùng bản procedural.
const overlay = document.getElementById('overlay')
const panel = document.getElementById('overlay-panel')
if (overlay && panel) {
  panel.className = 'panel loading'
  panel.innerHTML = '<p class="kicker">Đang tải mô hình nhân vật…</p>'
  overlay.classList.remove('hidden')
}

// Safari cũ hoặc máy không có WebGL2: báo rõ thay vì màn hình đen
const probe = document.createElement('canvas').getContext('webgl2')
if (!probe) {
  if (panel) {
    panel.innerHTML =
      '<h2>Trình duyệt chưa hỗ trợ WebGL2</h2><p class="lead">Hãy mở bằng Chrome, Edge, Firefox hoặc Safari 15 trở lên trên máy tính.</p>'
  }
} else if (params.has('nomodels')) {
  start()
} else {
  loadCharacterModels()
    .then((n) => console.info(`Đã tải ${n}/6 model nhân vật từ Blender.`))
    .catch((err) => console.warn('Không tải được model nhân vật:', err))
    .finally(start)
}
