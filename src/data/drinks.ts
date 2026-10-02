export type DrinkId =
  | 'honeyIce'
  | 'berryWine'
  | 'carrotJuice'
  | 'oakBeer'
  | 'moonWine'
  | 'leafTea'
  | 'forestMix'
  | 'water'

export interface DrinkDef {
  id: DrinkId
  name: string
  price: number
  /** Màu chất lỏng trong ly khi khách uống */
  color: number
}

export const DRINKS: Record<DrinkId, DrinkDef> = {
  honeyIce: { id: 'honeyIce', name: 'Mật ong đá', price: 18, color: 0xf2b134 },
  berryWine: { id: 'berryWine', name: 'Rượu dâu', price: 22, color: 0x9b2d5c },
  carrotJuice: { id: 'carrotJuice', name: 'Nước cà rốt', price: 12, color: 0xf08a24 },
  oakBeer: { id: 'oakBeer', name: 'Bia sồi', price: 15, color: 0xd9a441 },
  moonWine: { id: 'moonWine', name: 'Rượu trăng', price: 25, color: 0xbfe8ff },
  leafTea: { id: 'leafTea', name: 'Trà lá', price: 10, color: 0x8fbf6a },
  forestMix: { id: 'forestMix', name: 'Hỗn hợp rừng', price: 28, color: 0x6f9f3a },
  water: { id: 'water', name: 'Nước lã', price: 4, color: 0xcfe9ff },
}

export const DRINK_IDS = Object.keys(DRINKS) as DrinkId[]
