import type { DrinkId } from './drinks'

/** Loài khách ngẫu nhiên */
export type CustomerSpeciesId = 'bear' | 'fox' | 'rabbit' | 'boar' | 'wolf' | 'deer'
/** Mọi loài có model, kể cả nhân vật cốt truyện (lửng = đặc vụ, chồn = Thợ May) */
export type SpeciesId = CustomerSpeciesId | 'badger' | 'stoat'
export type EarShape = 'round' | 'pointed' | 'long' | 'small' | 'wide'
export type TailShape = 'stub' | 'bushy' | 'puff' | 'short' | 'long' | 'flag'
export type SnoutShape = 'long' | 'medium' | 'short' | 'flat'
export type CheekStyle = 'tufts' | 'blush'

export interface SpeciesDef {
  id: SpeciesId
  name: string
  /** Mô tả ngắn hiện trong sổ tay */
  furLabel: string
  earLabel: string
  tailLabel: string
  furColor: number
  bellyColor: number
  /** Màu lông "sai" dùng cho manh mối wrongFur */
  wrongFurColors: number[]
  earShape: EarShape
  earTipColor?: number
  earInnerColor?: number
  tailShape: TailShape
  tailTipColor?: number
  snoutColor: number
  noseColor: number
  /** Hình mõm */
  snout: SnoutShape
  /** Mảng lông sáng quanh mõm và má (cáo, sói, hươu) */
  maskColor?: number
  /** Dải lông sẫm ngang mắt (lửng) */
  bandColor?: number
  eyeColor: number
  cheeks?: CheekStyle
  buckTeeth?: boolean
  favoriteDrink: DrinkId
  slogan: string
  wrongSlogans: string[]
  question: string
  answer: string
  wrongAnswers: string[]
  weightKg: [number, number]
  /** Hệ số chiều cao so với mẫu chuẩn */
  height: number
  /** Hệ số bề ngang thân so với mẫu chuẩn (khớp torso trong tools/blender/build_characters.py) */
  torsoScale: number
  spots?: boolean
  tusks?: boolean
  antlers?: boolean
}

export const SPECIES: Record<CustomerSpeciesId, SpeciesDef> = {
  bear: {
    id: 'bear',
    name: 'Gấu',
    furLabel: 'Nâu đậm',
    earLabel: 'Tròn, nhỏ',
    tailLabel: 'Cụt',
    furColor: 0x6b4423,
    bellyColor: 0x9c7a52,
    wrongFurColors: [0xc2803b, 0x2a1c10],
    earShape: 'round',
    earInnerColor: 0x9c7a52,
    tailShape: 'stub',
    snoutColor: 0xc9a27e,
    noseColor: 0x1a1a1a,
    snout: 'short',
    eyeColor: 0x4a2f16,
    favoriteDrink: 'honeyIce',
    slogan: 'Rừng là nhà',
    wrongSlogans: ['Nhà là rừng', 'Rừng là của tôi'],
    question: 'Ngủ đông tháng mấy?',
    answer: 'Tháng mười một',
    wrongAnswers: ['Tháng ba', 'Tôi không ngủ đông'],
    weightKg: [250, 350],
    height: 1.12,
    torsoScale: 1.06,
  },
  fox: {
    id: 'fox',
    name: 'Cáo',
    furLabel: 'Cam, ngực trắng',
    earLabel: 'Nhọn, chóp đen',
    tailLabel: 'Xù, chóp trắng',
    furColor: 0xe0782a,
    bellyColor: 0xf5ede0,
    wrongFurColors: [0xb33a3a, 0xe0b050],
    earShape: 'pointed',
    earTipColor: 0x1a1a1a,
    tailShape: 'bushy',
    tailTipColor: 0xf5ede0,
    snoutColor: 0xf5ede0,
    noseColor: 0x1a1a1a,
    snout: 'long',
    maskColor: 0xf5ede0,
    eyeColor: 0xd98b2b,
    cheeks: 'tufts',
    favoriteDrink: 'berryWine',
    slogan: 'Khôn hơn người',
    wrongSlogans: ['Khôn như người', 'Nhanh hơn người'],
    question: 'Săn lúc nào?',
    answer: 'Lúc chạng vạng',
    wrongAnswers: ['Giữa trưa', 'Khi nào đói'],
    weightKg: [8, 12],
    height: 0.95,
    torsoScale: 0.92,
  },
  rabbit: {
    id: 'rabbit',
    name: 'Thỏ',
    furLabel: 'Trắng',
    earLabel: 'Dài, dựng đứng',
    tailLabel: 'Bông tròn',
    furColor: 0xededed,
    bellyColor: 0xffffff,
    wrongFurColors: [0xf3c4d3, 0xc8b89a],
    earShape: 'long',
    earInnerColor: 0xf2b8c6,
    tailShape: 'puff',
    snoutColor: 0xf2b8c6,
    noseColor: 0xd96a8a,
    snout: 'short',
    eyeColor: 0xb8485c,
    cheeks: 'blush',
    buckTeeth: true,
    favoriteDrink: 'carrotJuice',
    slogan: 'Nhảy cho tự do',
    wrongSlogans: ['Chạy cho tự do', 'Nhảy vì tự do'],
    question: 'Mấy con một lứa?',
    answer: 'Sáu con',
    wrongAnswers: ['Một con', 'Hai mươi con'],
    weightKg: [2, 4],
    height: 0.9,
    torsoScale: 0.9,
  },
  boar: {
    id: 'boar',
    name: 'Lợn rừng',
    furLabel: 'Xám nâu',
    earLabel: 'Nhỏ, vểnh',
    tailLabel: 'Ngắn, thẳng',
    furColor: 0x6e645a,
    bellyColor: 0x8a7f73,
    wrongFurColors: [0x4a6b3a, 0xa07850],
    earShape: 'small',
    tailShape: 'short',
    snoutColor: 0xb08a78,
    noseColor: 0x5a4038,
    snout: 'flat',
    eyeColor: 0x3a2418,
    favoriteDrink: 'oakBeer',
    slogan: 'Húc trước hỏi sau',
    wrongSlogans: ['Hỏi trước húc sau', 'Húc trước nghĩ sau'],
    question: 'Nanh dài bao nhiêu?',
    answer: 'Một gang tay',
    wrongAnswers: ['Một sải tay', 'Tôi không có nanh'],
    weightKg: [90, 150],
    height: 1.0,
    torsoScale: 1.06,
    tusks: true,
  },
  wolf: {
    id: 'wolf',
    name: 'Sói',
    furLabel: 'Xám bạc',
    earLabel: 'Nhọn, thẳng',
    tailLabel: 'Dài, rủ',
    furColor: 0x8c8f96,
    bellyColor: 0xd9dbde,
    wrongFurColors: [0x5c6fa0, 0xa88c6e],
    earShape: 'pointed',
    tailShape: 'long',
    snoutColor: 0xd9dbde,
    noseColor: 0x1a1a1a,
    snout: 'long',
    maskColor: 0xd9dbde,
    eyeColor: 0xe0b84a,
    cheeks: 'tufts',
    favoriteDrink: 'moonWine',
    slogan: 'Bầy trên hết',
    wrongSlogans: ['Bầy là nhất', 'Sói trên hết'],
    question: 'Hú khi nào?',
    answer: 'Khi trăng lên',
    wrongAnswers: ['Khi mặt trời mọc', 'Tôi không hú'],
    weightKg: [40, 60],
    height: 1.05,
    torsoScale: 0.97,
  },
  deer: {
    id: 'deer',
    name: 'Hươu',
    furLabel: 'Nâu vàng, có đốm',
    earLabel: 'To, hướng sang bên',
    tailLabel: 'Ngắn, trắng',
    furColor: 0xb98a4b,
    bellyColor: 0xe8d8b8,
    wrongFurColors: [0xd9603b, 0x8fa35a],
    earShape: 'wide',
    earInnerColor: 0xe8d8b8,
    tailShape: 'flag',
    tailTipColor: 0xffffff,
    snoutColor: 0xe8d8b8,
    noseColor: 0x1a1a1a,
    snout: 'medium',
    maskColor: 0xe8d8b8,
    eyeColor: 0x3a2a1a,
    cheeks: 'blush',
    favoriteDrink: 'leafTea',
    slogan: 'Chạy không ngoảnh',
    wrongSlogans: ['Chạy không ngừng', 'Chạy rồi ngoảnh'],
    question: 'Rụng gạc mùa nào?',
    answer: 'Cuối đông',
    wrongAnswers: ['Giữa hè', 'Gạc không rụng'],
    weightKg: [60, 100],
    height: 1.1,
    torsoScale: 0.89,
    spots: true,
    antlers: true,
  },
}

export const SPECIES_IDS = Object.keys(SPECIES) as CustomerSpeciesId[]
