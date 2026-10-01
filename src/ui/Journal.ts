import { $, show, esc, hex } from './dom'
import { SPECIES, SPECIES_IDS } from '@/data/species'
import { DRINKS } from '@/data/drinks'
import { cluesAvailableOnDay } from '@/data/clues'

export class Journal {
  private readonly root = $('journal')
  private readonly species = $('journal-species')
  private readonly clues = $('journal-clues')
  private readonly notes = $('journal-notes')
  visible = false

  constructor() {
    this.species.innerHTML = `
      <table>
        <thead><tr><th>Loài</th><th>Lông</th><th>Tai</th><th>Đuôi</th><th>Món ưa thích</th><th>Khẩu hiệu</th><th>Câu hỏi → Đáp án</th></tr></thead>
        <tbody>
          ${SPECIES_IDS.map((id) => {
            const s = SPECIES[id]
            return `<tr>
              <td><b>${esc(s.name)}</b></td>
              <td><i class="swatch" style="background:${hex(s.furColor)}"></i>${esc(s.furLabel)}</td>
              <td>${esc(s.earLabel)}</td>
              <td>${esc(s.tailLabel)}</td>
              <td>${esc(DRINKS[s.favoriteDrink].name)}</td>
              <td>“${esc(s.slogan)}”</td>
              <td>${esc(s.question)} → <b>${esc(s.answer)}</b></td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`
  }

  open(day: number, notes: string[]): void {
    const list = cluesAvailableOnDay(day)
    this.clues.innerHTML = `
      <ul>
        ${list
          .map(
            (c) =>
              `<li><b>${esc(c.name)}</b>${c.conclusive ? '' : ' <span class="weak">(chưa đủ kết luận)</span>'}<br><span class="hint">${esc(c.hint)}</span></li>`,
          )
          .join('')}
      </ul>
      ${day >= 2 ? '<p class="warn">Một số khách thật bị băng bó, đeo kính hoặc bạc lông. Đó không phải manh mối. Cần ít nhất một manh mối chắc chắn trước khi bắn.</p>' : ''}`
    this.notes.innerHTML = notes.length
      ? `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
      : '<p class="hint">Chưa có ghi chú.</p>'
    show(this.root, true)
    this.visible = true
  }

  close(): void {
    show(this.root, false)
    this.visible = false
  }
}
