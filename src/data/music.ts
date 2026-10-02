import type { SpeciesDef } from './species'
import type { CustomerSpec } from '@/characters/generateCustomers'

/**
 * Nhạc sống trong quán: Vịt Sax đứng trên bục góc trái, thổi saxophone bản ballad "Đêm Không Người".
 *
 * Bản nhạc là sáng tác nguyên bản viết cho game (không dùng giai điệu có bản quyền). Muốn đổi bài,
 * chỉ cần thay `BALLAD.melody` (mảng [nốt MIDI, số phách], nốt 0 = nghỉ) và `BALLAD.chords`.
 */

export const MUSICIAN_NAME = 'Vịt Sax'

/**
 * Nhạc phát trong quán qua trình phát YouTube nhúng chính thức (không tải file về, nghệ sĩ vẫn được tính lượt xem).
 * Video: "Phép Màu (Đàn Cá Gỗ OST) - Mounter x MAYDAYs, Minh Tốc | SAXOPHONE COVER" của kênh Tuấn Kiệt Saxophone.
 * Đặt videoId = '' để tắt và dùng file riêng / bản tổng hợp.
 */
export const JUKEBOX = {
  videoId: 'pI1hX9xxZIg',
  title: 'Phép Màu',
  artist: 'Tuấn Kiệt Saxophone',
  /** Nhịp ước lượng để vịt gật đầu (không đo được âm thanh từ YouTube) */
  bpm: 70,
}

/** Vịt trắng, mỏ và chân cam, không tai. Giữ đồng bộ 'duck' trong tools/blender. */
export const DUCK_SPECIES: SpeciesDef = {
  id: 'duck',
  name: 'Vịt',
  furLabel: 'Trắng kem',
  earLabel: 'Không có',
  tailLabel: 'Ngắn, vểnh',
  furColor: 0xf3efe2,
  bellyColor: 0xf3efe2,
  wrongFurColors: [],
  earShape: 'none',
  tailShape: 'flag',
  tailTipColor: 0xf3efe2,
  snoutColor: 0xf2a23a,
  noseColor: 0x3a2a1a,
  snout: 'bill',
  eyeColor: 0x2a2a2a,
  favoriteDrink: 'water',
  slogan: 'Nhạc không hỏi giấy tờ',
  wrongSlogans: [],
  question: 'Chơi điệu gì?',
  answer: 'Điệu buồn',
  wrongAnswers: [],
  weightKg: [2, 4],
  height: 0.92,
  torsoScale: 0.97,
}

export function duckSpec(): CustomerSpec {
  return {
    species: DUCK_SPECIES,
    isHuman: false,
    clues: new Set(),
    quirk: null,
    furColor: DUCK_SPECIES.furColor,
    look: { accessory: 'bowtie', accent: 0x1d3557, extras: ['shades'] },
    order: 'water',
    greeting: '',
    sloganText: DUCK_SPECIES.slogan,
    answerText: DUCK_SPECIES.answer,
    displayName: MUSICIAN_NAME,
  }
}

export interface Ballad {
  title: string
  bpm: number
  /** Hai hợp âm mỗi ô nhịp (mỗi hợp âm 2 phách); độ dài mảng = số ô nhịp × 2 */
  chords: string[]
  /** Giai điệu saxophone: [nốt MIDI (0 = nghỉ), số phách] */
  melody: [number, number][]
}

export const BALLAD: Ballad = {
  title: 'Đêm Không Người',
  bpm: 72,
  chords: [
    'Am9', 'Am9', 'Fmaj7', 'Fmaj7', 'Dm7', 'Dm7', 'E7', 'E7',
    'Am9', 'Am9', 'Fmaj7', 'Fmaj7', 'Dm7', 'G7', 'Cmaj7', 'E7',
    'Fmaj7', 'Fmaj7', 'Em7', 'Em7', 'Dm7', 'Dm7', 'G7sus', 'G7',
    'Cmaj7', 'Cmaj7', 'Am7', 'Am7', 'Dm7', 'E7', 'Am9', 'Am9',
    'Am9', 'Am9', 'Am9', 'Am9',
  ],
  melody: [
    // 1–4: câu hỏi
    [0, 1], [76, 1], [72, 1], [69, 1],
    [71, 0.5], [72, 1.5], [69, 1], [67, 1],
    [77, 1.5], [76, 0.5], [74, 2],
    [68, 1], [71, 1], [76, 2],
    // 5–8: trả lời
    [76, 0.5], [74, 0.5], [72, 1], [69, 2],
    [77, 1], [76, 1], [72, 2],
    [74, 1], [77, 1], [79, 1], [77, 1],
    [76, 3], [0, 1],
    // 9–12: lên cao
    [81, 1], [79, 1], [77, 2],
    [79, 1.5], [76, 0.5], [71, 2],
    [77, 1], [74, 1], [69, 1], [72, 1],
    [74, 2], [71, 1], [67, 1],
    // 13–16: về nhà
    [72, 1], [76, 1], [79, 2],
    [81, 1.5], [79, 0.5], [76, 2],
    [77, 1], [76, 1], [74, 0.5], [72, 0.5], [71, 1],
    [69, 4],
    // 17–18: nghỉ, chỉ còn nhạc đệm
    [0, 4],
    [0, 4],
  ],
}

/** Giọng hợp âm: bass (MIDI) + bè đệm không gốc quanh quãng tám 4 */
export const VOICINGS: Record<string, { bass: number; notes: number[] }> = {
  Am9: { bass: 45, notes: [60, 64, 67, 71] },
  Am7: { bass: 45, notes: [60, 64, 67, 69] },
  Fmaj7: { bass: 41, notes: [60, 64, 65, 69] },
  Dm7: { bass: 38, notes: [60, 62, 65, 69] },
  E7: { bass: 40, notes: [59, 62, 64, 68] },
  G7: { bass: 43, notes: [59, 62, 65, 67] },
  G7sus: { bass: 43, notes: [60, 62, 65, 67] },
  Cmaj7: { bass: 36, notes: [59, 60, 64, 67] },
  Em7: { bass: 40, notes: [59, 62, 64, 67] },
}
