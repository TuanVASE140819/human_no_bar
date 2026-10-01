import { $, show } from './dom'
import type { Tool } from '@/render/Player'

export class Hud {
  private readonly root = $('hud')
  private readonly day = $('hud-day')
  private readonly time = $('hud-time')
  private readonly remaining = $('hud-remaining')
  private readonly money = $('hud-money')
  private readonly rep = $('hud-rep')
  private readonly repBar = $('hud-rep-bar')
  private readonly tool = $('hud-tool')
  private readonly ammo = $('hud-ammo')
  private readonly hint = $('hint')
  private readonly crosshair = $('crosshair')

  setVisible(v: boolean): void {
    show(this.root, v)
  }

  setDay(day: number, total: number): void {
    this.day.textContent = `Ngày ${day} / ${total}`
  }

  setTime(label: string): void {
    this.time.textContent = label
  }

  setRemaining(n: number): void {
    this.remaining.textContent = `Khách còn: ${n}`
  }

  setMoney(n: number): void {
    this.money.textContent = `$${Math.round(n)}`
    this.money.classList.toggle('neg', n < 0)
  }

  setRep(n: number): void {
    this.rep.textContent = `Uy tín ${Math.round(n)}`
    this.repBar.style.width = `${Math.max(0, Math.min(100, n))}%`
    this.repBar.classList.toggle('low', n < 25)
  }

  setTool(tool: Tool): void {
    this.tool.textContent = tool === 'gun' ? 'Súng săn [2]' : 'Tay không [1]'
    this.crosshair.classList.toggle('gun', tool === 'gun')
  }

  setAmmo(n: number): void {
    this.ammo.textContent = `Đạn: ${'●'.repeat(Math.min(n, 12))}${n === 0 ? 'hết' : ''}`
    this.ammo.classList.toggle('neg', n === 0)
  }

  setZoom(z: boolean): void {
    this.crosshair.classList.toggle('zoom', z)
  }

  setHint(html: string): void {
    this.hint.innerHTML = html
  }
}
