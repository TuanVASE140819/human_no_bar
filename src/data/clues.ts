export type ClueId =
  | 'zipper'
  | 'earOff'
  | 'wrongFur'
  | 'fiveFingers'
  | 'humanShoes'
  | 'plasticEyes'
  | 'wrongDrink'
  | 'wrongSlogan'
  | 'wrongAnswer'

export type ClueTier = 'visual' | 'behavior' | 'hidden'

export interface ClueDef {
  id: ClueId
  tier: ClueTier
  name: string
  hint: string
  minDay: number
  /** Manh mối này một mình có đủ để kết luận không */
  conclusive: boolean
}

export const CLUES: ClueDef[] = [
  { id: 'zipper', tier: 'visual', name: 'Khóa kéo sau lưng', hint: 'Yêu cầu khách quay người (Q → 1).', minDay: 1, conclusive: true },
  { id: 'earOff', tier: 'visual', name: 'Tai lệch, sắp rơi', hint: 'Nhìn kỹ hai tai, một bên bị xệ.', minDay: 1, conclusive: true },
  { id: 'wrongFur', tier: 'visual', name: 'Màu lông sai loài', hint: 'So màu lông với hồ sơ loài trong sổ tay.', minDay: 1, conclusive: true },
  { id: 'wrongDrink', tier: 'behavior', name: 'Gọi sai món đặc trưng', hint: 'Thú thật thường gọi đúng món của loài, nhưng không phải luôn luôn.', minDay: 1, conclusive: false },
  { id: 'fiveFingers', tier: 'visual', name: 'Bàn tay năm ngón người', hint: 'Soi (chuột phải) vào bàn tay đang buông thõng.', minDay: 2, conclusive: true },
  { id: 'humanShoes', tier: 'visual', name: 'Giày người dưới chân', hint: 'Bước sát quầy và nhìn xuống chân khách.', minDay: 2, conclusive: true },
  { id: 'wrongSlogan', tier: 'behavior', name: 'Đọc sai khẩu hiệu', hint: 'Yêu cầu đọc khẩu hiệu (Q → 2), so với sổ tay.', minDay: 2, conclusive: true },
  { id: 'plasticEyes', tier: 'visual', name: 'Mắt nhựa, không chớp', hint: 'Nhìn thẳng vào mắt 3 giây. Thú thật sẽ chớp.', minDay: 3, conclusive: true },
  { id: 'wrongAnswer', tier: 'behavior', name: 'Trả lời sai câu hỏi loài', hint: 'Hỏi câu kiểm tra (Q → 3), so đáp án trong sổ tay.', minDay: 3, conclusive: true },
]

export const CLUE_BY_ID: Record<ClueId, ClueDef> = Object.fromEntries(CLUES.map((c) => [c.id, c])) as Record<
  ClueId,
  ClueDef
>

export function cluesAvailableOnDay(day: number): ClueDef[] {
  return CLUES.filter((c) => c.minDay <= day)
}

/** Điểm lạ của thú thật (bẫy ngược). Không phải manh mối. */
export type Quirk = 'bandage' | 'glasses' | 'greyPatch'
export const QUIRKS: Quirk[] = ['bandage', 'glasses', 'greyPatch']
