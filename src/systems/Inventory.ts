import { DRINK_IDS, DRINKS, type DrinkId } from '@/data/drinks'

/** Mỗi bình chứa tối đa bấy nhiêu ly */
export const MAX_STOCK = 8
/** Một thùng hàng châm được bấy nhiêu ly */
export const CRATE_SERVINGS = 6
/** Tồn kho đầu game, mỗi món */
export const START_STOCK = 3
/** Giây thật từ lúc đặt tới lúc thùng hàng xuất hiện */
export const DELIVERY_SECONDS = 20

export function cratePrice(id: DrinkId): number {
  return Math.round(DRINKS[id].price * 2.5)
}

/** Tồn kho đồ uống: bình trên quầy sau, đơn hàng đang giao. Không tự nạp lại qua đêm. */
export class Inventory {
  readonly stock = {} as Record<DrinkId, number>
  readonly pending: { id: DrinkId; left: number }[] = []
  deliverySeconds = DELIVERY_SECONDS

  constructor() {
    this.reset()
  }

  reset(): void {
    for (const id of DRINK_IDS) this.stock[id] = START_STOCK
    this.pending.length = 0
  }

  has(id: DrinkId): boolean {
    return this.stock[id] > 0
  }

  take(id: DrinkId): boolean {
    if (!this.has(id)) return false
    this.stock[id] -= 1
    return true
  }

  add(id: DrinkId, n: number): void {
    this.stock[id] = Math.min(MAX_STOCK, this.stock[id] + n)
  }

  order(id: DrinkId): void {
    this.pending.push({ id, left: this.deliverySeconds })
  }

  /** Giảm thời gian chờ giao; trả về các thùng vừa tới */
  update(dt: number): DrinkId[] {
    const arrived: DrinkId[] = []
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].left -= dt
      if (this.pending[i].left <= 0) {
        arrived.push(this.pending[i].id)
        this.pending.splice(i, 1)
      }
    }
    return arrived
  }

  /** 0..1 cho mức nước trong bình */
  level(id: DrinkId): number {
    return this.stock[id] / MAX_STOCK
  }

  get soldOut(): Set<DrinkId> {
    return new Set(DRINK_IDS.filter((id) => this.stock[id] <= 0))
  }

  /** Giây còn lại của đơn gần tới nhất, hoặc null */
  get nextArrival(): { id: DrinkId; left: number } | null {
    if (this.pending.length === 0) return null
    return this.pending.reduce((a, b) => (a.left < b.left ? a : b))
  }
}
