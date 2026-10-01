import { $, show, esc } from './dom'

export class Dialog {
  private readonly root = $('dialog')
  private readonly who = $('dialog-who')
  private readonly text = $('dialog-text')
  private readonly patience = $('dialog-patience')
  private readonly patienceBar = $('dialog-patience-bar')

  say(who: string, text: string): void {
    this.who.textContent = who
    this.text.innerHTML = esc(text)
    show(this.root, true)
    this.text.classList.remove('pop')
    void this.text.offsetWidth
    this.text.classList.add('pop')
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
    show(this.root, false)
  }
}
