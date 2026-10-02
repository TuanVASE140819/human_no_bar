import { $, show, esc } from './dom'
import type { DayConfig } from '@/data/difficulty'
import type { DayStats } from '@/systems/Economy'
import { sfx } from '@/core/Audio'

export class Overlay {
  private readonly root = $('overlay')
  private readonly panel = $('overlay-panel')
  visible = false

  private open(html: string, cls = ''): HTMLElement {
    this.panel.className = `panel ${cls}`
    this.panel.innerHTML = html
    show(this.root, true)
    this.visible = true
    return this.panel
  }

  hide(): void {
    show(this.root, false)
    this.visible = false
  }

  private bind(id: string, cb: () => void): void {
    const btn = this.panel.querySelector<HTMLButtonElement>(`#${id}`)
    btn?.addEventListener('click', cb)
  }

  private bindFullscreen(id: string): void {
    this.bind(id, () => {
      const doc = document as Document & { webkitExitFullscreen?: () => void }
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
      if (document.fullscreenElement) void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      else void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
    })
  }

  showMenu(onStart: () => void): void {
    const isMac = /Mac/i.test(navigator.platform) || /Macintosh/.test(navigator.userAgent)
    const macNote = isMac
      ? 'Mac: chuột phải = chạm hai ngón trên trackpad hoặc Ctrl + click; Esc để thả chuột. '
      : ''
    this.open(
      `
      <p class="kicker">Một quán bar. Không phục vụ người.</p>
      <h1>No Humans Bar</h1>
      <p class="lead">Động vật đã thắng cuộc chiến. Bạn là gorilla chủ quán. Một số khách là <b>người mặc costume</b>. Soi kỹ, hỏi khẽ, và chỉ bóp cò khi chắc chắn.</p>
      <div class="controls">
        <div><span class="key">Chuột</span> nhìn</div>
        <div><span class="key">W A S D</span> đi lại sau quầy</div>
        <div><span class="key">Chuột phải</span> / <span class="key">Shift</span> giữ để soi</div>
        <div><span class="key">Q</span> yêu cầu khách</div>
        <div><span class="key">E</span> phục vụ</div>
        <div><span class="key">1 / 2</span> tay không / súng</div>
        <div><span class="key">Chuột trái</span> / <span class="key">Space</span> bắn</div>
        <div><span class="key">Tab</span> sổ tay</div>
        <div><span class="key">M</span> tắt / bật âm thanh</div>
      </div>
      <div class="row">
        <button id="btn-start" class="primary">Bắt đầu ca làm</button>
        <button id="btn-full" class="ghost">Toàn màn hình</button>
      </div>
      <p class="fine">${macNote}Bản M1, đồ họa toon. Máy yếu: thêm <b>?nofx</b> vào địa chỉ để tắt hậu kỳ.</p>
    `,
      'menu',
    )
    this.bind('btn-start', onStart)
    this.bindFullscreen('btn-full')
  }

  showMorning(cfg: DayConfig, expectedCustomers: number, ammo: number, onOpen: () => void): void {
    this.open(`
      <p class="kicker">Buổi sáng</p>
      <h2>Ngày ${cfg.day}</h2>
      <ul class="news">
        ${cfg.news.map((n) => `<li>${esc(n)}</li>`).join('')}
        <li>Dự kiến khoảng <b>${expectedCustomers}</b> khách. Tỷ lệ người trà trộn ước tính <b>${Math.round(cfg.humanRate * 100)}%</b>.</li>
        <li>Đạn trong kho: <b>${ammo}</b>.</li>
      </ul>
      <button id="btn-open" class="primary">Mở cửa</button>
    `)
    this.bind('btn-open', onOpen)
  }

  showSummary(
    day: number,
    stats: DayStats,
    money: number,
    reputation: number,
    isLast: boolean,
    onNext: () => void,
  ): void {
    const net = stats.earned + stats.bounties - stats.penalties
    this.open(`
      <p class="kicker">Đóng cửa</p>
      <h2>Tổng kết ngày ${day}</h2>
      <table class="summary">
        <tr><td>Khách đã phục vụ</td><td>${stats.served}</td></tr>
        <tr><td>Người bắt đúng</td><td class="good">${stats.caught}</td></tr>
        <tr><td>Bắn nhầm thú</td><td class="${stats.misfires ? 'bad' : ''}">${stats.misfires}</td></tr>
        <tr><td>Người lọt qua (lộ trên tin sáng)</td><td class="${stats.slipped ? 'bad' : ''}">${stats.slipped}</td></tr>
        <tr><td>Khách bỏ về</td><td>${stats.walkedOut}</td></tr>
        <tr class="sep"><td>Doanh thu đồ uống</td><td>+$${Math.round(stats.earned)}</td></tr>
        <tr><td>Tiền thưởng bắt người</td><td>+$${stats.bounties}</td></tr>
        <tr><td>Tiền phạt, bồi thường</td><td class="${stats.penalties ? 'bad' : ''}">−$${stats.penalties}</td></tr>
        <tr class="total"><td>Lãi ròng trong ngày</td><td class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : '−'}$${Math.abs(Math.round(net))}</td></tr>
        <tr><td>Tiền hiện có</td><td class="${money < 0 ? 'bad' : ''}">$${Math.round(money)}</td></tr>
        <tr><td>Uy tín</td><td>${reputation}</td></tr>
      </table>
      <p class="fine">Đêm phòng thủ và pha chế sẽ được thêm ở mốc M2, M3.</p>
      <button id="btn-next" class="primary">${isLast ? 'Xem kết quả' : 'Ngày tiếp theo'}</button>
    `)
    this.bind('btn-next', onNext)
  }

  showGameOver(reason: string, day: number, onRestart: () => void): void {
    this.open(
      `
      <p class="kicker">Hết ca</p>
      <h1>Quán đóng cửa</h1>
      <p class="lead">${esc(reason)}</p>
      <p>Bạn trụ được đến ngày <b>${day}</b>.</p>
      <button id="btn-restart" class="primary">Chơi lại</button>
    `,
      'over',
    )
    this.bind('btn-restart', onRestart)
  }

  showWin(score: number, money: number, reputation: number, caught: number, onRestart: () => void): void {
    this.open(
      `
      <p class="kicker">Tuần đầu tiên</p>
      <h1>Bạn sống sót</h1>
      <p class="lead">Quán vẫn mở cửa sau 7 ngày. Không người nào được phục vụ mà không trả giá.</p>
      <table class="summary">
        <tr><td>Tiền</td><td>$${Math.round(money)}</td></tr>
        <tr><td>Uy tín</td><td>${reputation}</td></tr>
        <tr><td>Tổng người bắt được</td><td>${caught}</td></tr>
        <tr class="total"><td>Điểm</td><td class="good">${score}</td></tr>
      </table>
      <button id="btn-restart" class="primary">Chơi lại</button>
    `,
      'win',
    )
    this.bind('btn-restart', onRestart)
  }

  showPause(onResume: () => void): void {
    this.open(
      `
      <h2>Tạm dừng</h2>
      <p class="lead">Nhấn nút để cầm lại chuột.</p>
      <div class="row">
        <button id="btn-resume" class="primary">Tiếp tục</button>
        <button id="btn-full" class="ghost">Toàn màn hình</button>
        <button id="btn-sound" class="ghost">Âm thanh: ${sfx.muted ? 'Tắt' : 'Bật'}</button>
      </div>
    `,
      'pause',
    )
    this.bind('btn-resume', onResume)
    this.bindFullscreen('btn-full')
    this.bind('btn-sound', () => {
      sfx.unlock()
      const muted = sfx.toggleMute()
      const btn = this.panel.querySelector<HTMLButtonElement>('#btn-sound')
      if (btn) btn.textContent = `Âm thanh: ${muted ? 'Tắt' : 'Bật'}`
    })
  }
}
