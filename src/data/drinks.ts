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
}

export const DRINKS: Record<DrinkId, DrinkDef> = {
  honeyIce: { id: 'honeyIce', name: 'Mật ong đá', price: 18 },
  berryWine: { id: 'berryWine', name: 'Rượu dâu', price: 22 },
  carrotJuice: { id: 'carrotJuice', name: 'Nước cà rốt', price: 12 },
  oakBeer: { id: 'oakBeer', name: 'Bia sồi', price: 15 },
  moonWine: { id: 'moonWine', name: 'Rượu trăng', price: 25 },
  leafTea: { id: 'leafTea', name: 'Trà lá', price: 10 },
  forestMix: { id: 'forestMix', name: 'Hỗn hợp rừng', price: 28 },
  water: { id: 'water', name: 'Nước lã', price: 4 },
}

export const DRINK_IDS = Object.keys(DRINKS) as DrinkId[]
