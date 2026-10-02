export interface DayStats {
  served: number
  caught: number
  misfires: number
  slipped: number
  walkedOut: number
  earned: number
  bounties: number
  penalties: number
  /** Tiền nhập hàng trong ngày */
  supplies: number
}

function freshStats(): DayStats {
  return { served: 0, caught: 0, misfires: 0, slipped: 0, walkedOut: 0, earned: 0, bounties: 0, penalties: 0, supplies: 0 }
}

export const BOUNTY = 60
export const MISFIRE_FINE = 150
export const REP_CATCH = 5
export const REP_MISFIRE = -20
export const REP_SLIPPED = -10
export const REP_SERVED = 1
export const REP_WALKOUT = -2

export class Economy {
  money = 200
  reputation = 50
  ammo = 6
  stats: DayStats = freshStats()
  log: string[] = []
  onChange?: () => void

  newDay(): void {
    this.stats = freshStats()
    this.log = []
    this.emit()
  }

  earn(amount: number): void {
    this.money += amount
    this.stats.earned += amount
    this.emit()
  }

  bounty(amount: number): void {
    this.money += amount
    this.stats.bounties += amount
    this.emit()
  }

  fine(amount: number): void {
    this.money -= amount
    this.stats.penalties += amount
    this.emit()
  }

  /** Chi tiền nhập hàng; trả về false nếu không đủ tiền */
  spend(amount: number): boolean {
    if (this.money < amount) return false
    this.money -= amount
    this.stats.supplies += amount
    this.emit()
    return true
  }

  addRep(delta: number): void {
    this.reputation = Math.max(0, Math.min(100, this.reputation + delta))
    this.emit()
  }

  useAmmo(): boolean {
    if (this.ammo <= 0) return false
    this.ammo -= 1
    this.emit()
    return true
  }

  addAmmo(n: number): void {
    this.ammo += n
    this.emit()
  }

  note(line: string): void {
    this.log.push(line)
  }

  /** Giá bán nhân theo uy tín: 0.8 → 1.2 */
  get priceMod(): number {
    return 0.8 + 0.4 * (this.reputation / 100)
  }

  /** Số khách nhân theo uy tín: 0.7 → 1.3 */
  get customerMod(): number {
    return 0.7 + 0.6 * (this.reputation / 100)
  }

  private emit(): void {
    this.onChange?.()
  }
}
