import { $, show, esc } from './dom'
import { sfx } from '@/core/Audio'

/** Hộp thoại khách / đặc vụ. Chế độ chữ chạy dùng cho cảnh cốt truyện, kèm mũi tên "tiếp". */
export class Dialog {
  private readonly root = $('dialog')
  private readonly who = $('dialog-who')
  private readonly text = $('dialog-text')
  private readonly patience = $('dialog-patience')
  private readonly patienceBar = $('dialog-patience-bar')

  private full = ''
  private shown = 0
  private typing = false
  private prompt = false
  /** ký tự mỗi giây khi chữ chạy */
  speed = 42

  say(who: string, text: string, typewriter = false): void {
    this.who.textContent = who
    this.full = text
    this.typing = typewriter
    this.shown = typewriter ? 0 : text.length
    this.render()
    show(this.root, true)
    this.text.classList.remove('pop')
    void this.text.offsetWidth
    this.text.classList.add('pop')
  }

  get isTyping(): boolean {
    return this.typing
  }

  /** Hiện hết câu ngay lập tức */
  finish(): void {
    if (!this.typing) return
    this.shown = this.full.length
    this.typing = false
    this.render()
  }

  /** Bật/tắt mũi tên gợi ý bấm tiếp (chỉ hiện khi câu đã chạy hết) */
  setPrompt(on: boolean): void {
    this.prompt = on
    this.render()
  }

  update(dt: number): void {
    if (!this.typing) return
    const before = Math.floor(this.shown / 3)
    this.shown = Math.min(this.full.length, this.shown + dt * this.speed)
    if (Math.floor(this.shown / 3) !== before) sfx.blip()
    if (this.shown >= this.full.length) this.typing = false
    this.render()
  }

  setPatience(k: number | null): void {
    if (k === null) {
      show(this.patience, false)
      return
    }
    show(this.patience, true)
    const pct = Math.max(0, Math.min(1, k)) * 100
    this.patienceBar.style.width = `${pct}%`
    this.patienceBar.classList.toggle('low', k < 0.3)
  }

  hide(): void {
    this.typing = false
    this.prompt = false
    show(this.root, false)
  }

  private render(): void {
    const visible = esc(this.full.slice(0, Math.floor(this.shown)))
    const arrow = this.prompt && !this.typing ? '<span class="next">▼</span>' : ''
    this.text.innerHTML = visible + arrow
  }
}
