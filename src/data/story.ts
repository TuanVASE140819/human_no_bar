import type { SpeciesDef } from './species'
import type { DayStats } from '@/systems/Economy'
import type { CustomerSpec } from '@/characters/generateCustomers'

/**
 * Cốt truyện: Đặc vụ Lửng của Cục Kiểm Soát Nhân Loại ghé quán mỗi sáng.
 * Ngày 1 kể bối cảnh và luật chơi; các ngày sau nhắc hậu quả hôm trước và hé lộ tình tiết mới.
 */

export const AGENT_NAME = 'Đặc vụ Lửng'

/** Lửng: thân xám sẫm, mặt trắng có dải sọc đen ngang mắt. Giữ đồng bộ 'badger' trong tools/blender. */
export const AGENT_SPECIES: SpeciesDef = {
  id: 'badger',
  name: 'Lửng',
  furLabel: 'Xám sẫm, mặt trắng sọc đen',
  earLabel: 'Tròn, nhỏ',
  tailLabel: 'Xù, ngắn',
  furColor: 0x474c55,
  bellyColor: 0x8f959d,
  wrongFurColors: [],
  earShape: 'round',
  earInnerColor: 0xcfcfcf,
  tailShape: 'bushy',
  tailTipColor: 0xbfbfbf,
  snoutColor: 0xececec,
  noseColor: 0x111111,
  snout: 'medium',
  maskColor: 0xececec,
  bandColor: 0x1c1c1c,
  eyeColor: 0x2a2a2a,
  favoriteDrink: 'water',
  slogan: 'Luật là luật',
  wrongSlogans: [],
  question: 'Ai trả lương cho anh?',
  answer: 'Thành phố',
  wrongAnswers: [],
  weightKg: [10, 16],
  height: 1.0,
  torsoScale: 1.03,
}

export function agentSpec(): CustomerSpec {
  return {
    species: AGENT_SPECIES,
    isHuman: false,
    clues: new Set(),
    quirk: null,
    furColor: AGENT_SPECIES.furColor,
    look: { accessory: 'coat', accent: 0x8a6a3c, extras: ['hat', 'shades'] },
    order: AGENT_SPECIES.favoriteDrink,
    greeting: '',
    sloganText: AGENT_SPECIES.slogan,
    answerText: AGENT_SPECIES.answer,
  }
}

/** Lời thoại mở đầu ngày 1 */
export function introLines(): string[] {
  return [
    'Chủ quán. Đặc vụ Lửng, Cục Kiểm Soát Nhân Loại. Đừng rót gì cho tôi, tôi đang làm việc.',
    'Chiến tranh xong ba năm rồi, nhưng người chưa hết. Chúng chui vào costume thú, lẻn vào thành phố qua những quán như của anh.',
    'Từ hôm nay quán anh là chốt kiểm soát. Khách nào đứng ở quầy này cũng phải qua mắt anh trước khi được uống.',
    'Luật rất ngắn: thấy người thì bắn. Mỗi tên anh hạ, thành phố thưởng 60 đô và uy tín của anh tăng.',
    'Nhưng bắn nhầm thú thật thì anh đền 150 đô, mất uy tín, khách bỏ chạy. Nhầm vài lần là quán sập.',
    'Cách soi: tai lệch, khóa kéo sau lưng, tay năm ngón, giày dưới chân, mắt nhựa không chớp. Hỏi khẩu hiệu, hỏi câu hỏi loài. Chúng thuộc bài rất kém.',
    'Hôm nay tình báo nói có ít nhất một tên trà trộn. Tôi sẽ ghé lại mỗi sáng. Chúc may mắn, chủ quán.',
  ]
}

const LORE: Record<number, string> = {
  2: 'Tin mới: bọn người mua costume cũ ở chợ đen. Đường khóa kéo sau lưng khâu rất ẩu, yêu cầu khách quay người là thấy.',
  3: 'Chúng bắt đầu học thuộc khẩu hiệu. Hỏi câu hỏi loài đi, câu đó khó học hơn nhiều.',
  4: 'Một lô mắt nhựa hạng tốt vừa lọt vào thành phố. Nhìn thẳng vào mắt khách vài giây: thú thật sẽ chớp.',
  5: 'Hôm nay thị trưởng Gấu có thể ghé quán. Ông ấy là thú thật. Nhắc lại: thật.',
  6: 'Lễ hội Ngày Chiến Thắng. Khách đông gấp rưỡi, và bọn người cũng tận dụng đám đông để chen vào.',
  7: 'Ngày cuối của đợt kiểm soát. Trụ được hôm nay, thành phố nợ anh một ân huệ. Gục hôm nay thì... thôi, đừng gục.',
}

/** Lời thoại các sáng sau: báo cáo hôm qua, tình tiết mới, chào tạm biệt */
export function dailyLines(day: number, yesterday: DayStats | null): string[] {
  const lines: string[] = ['Sáng rồi, chủ quán. Báo cáo ngắn thôi.']
  if (yesterday) {
    lines.push(`Hôm qua anh phục vụ ${yesterday.served} khách, bắt ${yesterday.caught} tên người giả.`)
    if (yesterday.misfires > 0) {
      lines.push(
        `Và bắn nhầm ${yesterday.misfires} thú thật. Tòa thị chính đang nhận đơn kiện, tôi là người phải đọc.`,
      )
    }
    if (yesterday.slipped > 0) {
      lines.push(
        `${yesterday.slipped} tên lọt qua quầy anh. Đêm qua chúng rạch bốn lốp xe của tôi. Bốn. Soi kỹ hơn.`,
      )
    } else {
      lines.push('Không tên nào lọt. Hiếm quán nào trong thành phố làm được, đừng để tôi phải nói lại.')
    }
    if (yesterday.walkedOut > 0) {
      lines.push(`${yesterday.walkedOut} khách bỏ về vì chờ lâu. Người ta bắt đầu đồn anh chậm.`)
    }
  }
  const lore = LORE[day]
  if (lore) lines.push(lore)
  lines.push('Tôi đi đây. Mở cửa đi.')
  return lines
}
