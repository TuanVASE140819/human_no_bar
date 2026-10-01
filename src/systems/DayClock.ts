/** Đồng hồ trong ngày: 10:00 → 18:00 chạy trong `realSeconds` giây thật. */
export class DayClock {
  readonly startMinutes = 10 * 60
  readonly endMinutes = 18 * 60
  realSeconds = 300
  minutes = this.startMinutes

  reset(): void {
    this.minutes = this.startMinutes
  }

  update(dt: number): void {
    const perSecond = (this.endMinutes - this.startMinutes) / this.realSeconds
    this.minutes = Math.min(this.endMinutes, this.minutes + dt * perSecond)
  }

  /** Nhảy thẳng tới giờ đóng cửa (khi hết khách sớm). */
  finish(): void {
    this.minutes = this.endMinutes
  }

  get progress(): number {
    return (this.minutes - this.startMinutes) / (this.endMinutes - this.startMinutes)
  }

  get isOver(): boolean {
    return this.minutes >= this.endMinutes
  }

  get label(): string {
    const h = Math.floor(this.minutes / 60)
    const m = Math.floor(this.minutes % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
}
