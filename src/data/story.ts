import { SPECIES, type SpeciesDef } from './species'
import type { DayStats } from '@/systems/Economy'
import type { CustomerSpec } from '@/characters/generateCustomers'

/**
 * Cốt truyện 7 ngày.
 *
 * Đặc vụ Lửng (Cục Kiểm Soát Nhân Loại) ghé quán mỗi sáng: ngày 1 kể bối cảnh và luật,
 * các ngày sau báo cáo hậu quả hôm trước và đẩy một bí ẩn: "Thợ May", kẻ may costume cho người.
 * Ba khách cốt truyện xuất hiện giữa ngày:
 *   - Ngày 3: Thỏ run rẩy, chỉ điểm, hé lộ Thợ May không bán cho cướp mà may cho người muốn trốn.
 *             Người chơi chọn hứa báo đặc vụ hay giữ kín.
 *   - Ngày 5: Thị trưởng Gấu, thú thật ba đời, tiết lộ Cục đang thiếu chỉ tiêu "30 cái đầu".
 *             Phục vụ: +$200, +10 uy tín. Bắn: thua ngay.
 *   - Ngày 7: Thợ May (chồn đeo kính, người thật, costume không một sơ hở) tới đề nghị.
 *             Đặc vụ xông vào, đứng xem. Phục vụ = để ông ấy đi (+$500), bắn = nộp (+$300).
 *             Hai kết thúc khác nhau.
 */

export const AGENT_NAME = 'Đặc vụ Lửng'

export type StoryRole = 'informant' | 'mayor' | 'tailor'
export type Ending = 'bureau' | 'tailor'

export interface StoryFlags {
  /** Ngày 3: hứa báo đặc vụ (true), giữ kín (false), chưa trả lời (null) */
  reported: boolean | null
  /** Ngày 3: chỉ điểm bị bắn */
  informantShot: boolean
  /** Ngày 5: thị trưởng được phục vụ */
  mayorServed: boolean
  ending: Ending | null
}

export function newStoryFlags(): StoryFlags {
  return { reported: null, informantShot: false, mayorServed: false, ending: null }
}

/** Khách cốt truyện xuất hiện ngày nào, sau bao nhiêu khách thường */
export const STORY_DAYS: Record<number, { role: StoryRole; afterCustomers: number }> = {
  3: { role: 'informant', afterCustomers: 2 },
  5: { role: 'mayor', afterCustomers: 3 },
  7: { role: 'tailor', afterCustomers: 3 },
}

// ---------- Nhân vật ----------

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

/** Chồn: thon, nâu, bụng kem, đuôi dài chóp đen. Giữ đồng bộ 'stoat' trong tools/blender. */
export const TAILOR_SPECIES: SpeciesDef = {
  id: 'stoat',
  name: 'Chồn',
  furLabel: 'Nâu, bụng kem',
  earLabel: 'Tròn, nhỏ',
  tailLabel: 'Dài, chóp đen',
  furColor: 0x8b6a46,
  bellyColor: 0xf1e9d8,
  wrongFurColors: [],
  earShape: 'round',
  earInnerColor: 0xf1e9d8,
  tailShape: 'long',
  tailTipColor: 0x1a1a1a,
  snoutColor: 0xf1e9d8,
  noseColor: 0x1a1a1a,
  snout: 'long',
  maskColor: 0xf1e9d8,
  eyeColor: 0x3a2a1a,
  favoriteDrink: 'water',
  slogan: 'Kim chỉ không hỏi tên',
  wrongSlogans: [],
  question: 'May cho ai?',
  answer: 'Cho ai cần đi',
  wrongAnswers: [],
  weightKg: [1, 2],
  height: 0.95,
  torsoScale: 0.84,
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
    displayName: AGENT_NAME,
  }
}

export function storySpec(role: StoryRole): CustomerSpec {
  switch (role) {
    case 'informant': {
      const s = SPECIES.rabbit
      return {
        species: s,
        isHuman: false,
        clues: new Set(),
        quirk: null,
        furColor: 0xd9d4c8,
        look: { accessory: 'scarf', accent: 0x6b7a8f },
        order: 'carrotJuice',
        greeting: '',
        sloganText: s.slogan,
        answerText: s.answer,
        displayName: 'Thỏ run rẩy',
        story: 'informant',
      }
    }
    case 'mayor': {
      const s: SpeciesDef = { ...SPECIES.bear, height: 1.2 }
      return {
        species: s,
        isHuman: false,
        clues: new Set(),
        quirk: null,
        furColor: 0x5a3a1c,
        look: { accessory: 'sash', accent: 0xd4af37, extras: ['hat'] },
        order: 'honeyIce',
        greeting: '',
        sloganText: s.slogan,
        answerText: s.answer,
        displayName: 'Thị trưởng Gấu',
        story: 'mayor',
      }
    }
    case 'tailor':
      return {
        species: TAILOR_SPECIES,
        isHuman: true,
        clues: new Set(),
        quirk: 'glasses',
        furColor: TAILOR_SPECIES.furColor,
        look: { accessory: 'scarf', accent: 0x6a4c93, extras: ['beret'] },
        order: 'water',
        greeting: '',
        sloganText: TAILOR_SPECIES.slogan,
        answerText: TAILOR_SPECIES.answer,
        displayName: 'Thợ May',
        story: 'tailor',
      }
  }
}

// ---------- Lời thoại đặc vụ ----------

/** Lời thoại mở đầu ngày 1 */
export function introLines(): string[] {
  return [
    'Chủ quán. Đặc vụ Lửng, Cục Kiểm Soát Nhân Loại. Đừng rót gì cho tôi, tôi đang làm việc.',
    'Chiến tranh xong ba năm rồi, nhưng người chưa hết. Chúng chui vào costume thú, lẻn vào thành phố qua những quán như của anh.',
    'Từ hôm nay quán anh là chốt kiểm soát. Khách nào đứng ở quầy này cũng phải qua mắt anh trước khi được uống.',
    'Luật rất ngắn: thấy người thì bắn. Mỗi tên anh hạ, thành phố thưởng 60 đô và uy tín của anh tăng.',
    'Nhưng bắn nhầm thú thật thì anh đền 150 đô, mất uy tín, khách bỏ chạy. Nhầm vài lần là quán sập.',
    'Cách soi: tai lệch, khóa kéo sau lưng, tay năm ngón, giày dưới chân, mắt nhựa không chớp. Hỏi khẩu hiệu, hỏi câu hỏi loài. Chúng thuộc bài rất kém.',
    'Có một kẻ đang may costume cho chúng. Trong hồ sơ hắn tên là Thợ May. Tìm được hắn, anh giàu. Tôi sẽ ghé lại mỗi sáng.',
  ]
}

function report(y: DayStats): string[] {
  const lines = [`Hôm qua anh phục vụ ${y.served} khách, bắt ${y.caught} tên người giả.`]
  if (y.misfires > 0) {
    lines.push(`Và bắn nhầm ${y.misfires} thú thật. Tòa thị chính đang nhận đơn kiện, tôi là người phải đọc.`)
  }
  if (y.slipped > 0) {
    lines.push(`${y.slipped} tên lọt qua quầy anh. Đêm qua chúng rạch bốn lốp xe của tôi. Bốn. Soi kỹ hơn.`)
  } else {
    lines.push('Không tên nào lọt. Hiếm quán nào trong thành phố làm được, đừng để tôi phải nói lại.')
  }
  if (y.walkedOut > 0) lines.push(`${y.walkedOut} khách bỏ về vì chờ lâu. Người ta bắt đầu đồn anh chậm.`)
  return lines
}

/** Lời thoại các sáng sau: báo cáo hôm qua, tình tiết theo vòng cung và theo lựa chọn của người chơi */
export function dailyLines(day: number, yesterday: DayStats | null, f: StoryFlags): string[] {
  const lines: string[] = ['Sáng rồi, chủ quán. Báo cáo ngắn thôi.']
  if (yesterday) lines.push(...report(yesterday))
  switch (day) {
    case 2:
      lines.push(
        'Tin mới: bọn người mua costume ở chợ đen, từ chính Thợ May. Đường khóa kéo sau lưng khâu rất ẩu, yêu cầu khách quay người là thấy.',
        'Khách nào nhắc tới Thợ May, anh báo tôi. Đó là lệnh, không phải nhờ.',
      )
      break
    case 3:
      lines.push(
        'Chúng bắt đầu học thuộc khẩu hiệu. Hỏi câu hỏi loài đi, câu đó khó học hơn nhiều.',
        'Hôm nay có thể có kẻ muốn nói chuyện riêng với anh. Nghe xong, nhớ là anh làm việc cho ai.',
      )
      break
    case 4:
      if (f.informantShot) {
        lines.push('Nghe nói hôm qua anh bắn một con thỏ. Thú thật. Và là chỉ điểm của TÔI. Anh nợ tôi một chỉ điểm, chủ quán.')
      } else if (f.reported === true) {
        lines.push('Anh báo đúng. Con thỏ đó đã được "mời lên trụ sở". Nó khai Thợ May là một con chồn đeo kính. Thấy chồn là báo.')
      } else if (f.reported === false) {
        lines.push('Có khách nào nhắc tới Thợ May không?... Không à. Mắt anh nhìn đi chỗ khác khi nói dối, chủ quán. Tôi ghi nhận.')
      } else {
        lines.push('Tin tình báo nói Thợ May là một con chồn đeo kính. Thấy chồn là báo.')
      }
      lines.push('Một lô mắt nhựa hạng tốt vừa lọt vào thành phố. Nhìn thẳng vào mắt khách vài giây: thú thật sẽ chớp.')
      break
    case 5:
      lines.push(
        'Hôm nay thị trưởng Gấu sẽ ghé quán. Ông ấy là thú thật, ba đời làm gấu. Nhắc lại: thật.',
        'Ông ấy hỏi nhiều. Trả lời ít thôi.',
      )
      break
    case 6:
      lines.push('Chỉ tiêu tuần của Cục: 30 cái đầu. Cả thành phố mới có 19.')
      lines.push('Hôm nay nghi là bắn, chủ quán. Tôi sẽ ký giấy cho anh. Lễ hội Ngày Chiến Thắng, khách đông gấp rưỡi, không ai đếm đâu.')
      if (f.mayorServed) lines.push('Thị trưởng khen anh với hội đồng. Tôi không thích khi ông ấy khen ai.')
      break
    case 7:
      lines.push(
        'Ngày cuối. Thợ May sẽ tới quán anh hôm nay. Tôi biết, vì chính tôi để lộ tin anh là chủ quán có thể mua được.',
        'Khi hắn tới, tôi sẽ có mặt. Đừng làm tôi thất vọng. Hoặc cứ làm, tôi sẽ nhớ.',
      )
      break
    default:
      break
  }
  lines.push('Tôi đi đây. Mở cửa đi.')
  return lines
}

// ---------- Khách cốt truyện ----------

export function storyLines(role: StoryRole): string[] {
  switch (role) {
    case 'informant':
      return [
        'Ông chủ... cho tôi nói nhỏ. Đừng nhìn ra cửa.',
        'Thợ May không bán costume cho bọn cướp. Ông ấy may cho những người muốn RA khỏi thành phố. Có cả trẻ con.',
        'Lửng biết. Lửng không cần người, Lửng cần chỉ tiêu. Mỗi cái đầu là một con số trong báo cáo của hắn.',
        'Tôi không nên nói chuyện này. Nếu Lửng hỏi, ông chủ sẽ nói gì?',
      ]
    case 'mayor':
      return [
        'Chủ quán! Thị trưởng Gấu đây. Đừng đứng dậy, tôi biết anh đang đứng rồi.',
        'Quán anh nổi tiếng lắm: nơi duy nhất trong thành phố mà Lửng chưa đặt được quầy kiểm soát riêng.',
        'Nói nhỏ: Cục của hắn sắp bị cắt ngân sách nếu tuần này không đủ 30 cái đầu. Hắn sẽ ép anh bắn. Đừng để hắn biến quầy anh thành pháp trường.',
        'Cho tôi một Mật ong đá. Và nhớ: tôi là gấu thật. Ba đời làm gấu.',
      ]
    case 'tailor':
      return [
        'Chào chủ quán. Tôi là người anh đang tìm. Hoặc đang bị bảo phải tìm.',
        'Soi đi. Tai, tay, chân, khóa kéo. Anh sẽ không thấy gì đâu. Tôi may chúng mà.',
        'Tối nay có mười hai người cần ra khỏi thành phố qua cửa kho của anh. Bốn đứa là trẻ con. Chúng chưa từng thấy biển.',
        'Tôi để 500 đô trên quầy. Anh chỉ cần nhìn đi chỗ khác. Hoặc bóp cò, nhận 300 đô thưởng và một tấm huy chương.',
      ]
  }
}

export interface StoryChoice {
  options: { label: string; reply: string[]; apply: (f: StoryFlags) => void }[]
}

export function storyChoice(role: StoryRole): StoryChoice | null {
  if (role !== 'informant') return null
  return {
    options: [
      {
        label: 'Tôi sẽ báo đặc vụ.',
        reply: ['...Vậy thì coi như tôi chưa nói gì. Cho tôi Nước cà rốt. Nhanh lên, làm ơn.'],
        apply: (f) => {
          f.reported = true
        },
      },
      {
        label: 'Tôi sẽ giữ kín.',
        reply: ['Cảm ơn ông chủ. Nếu một ngày có một con chồn đeo kính bước vào, hãy nghe ông ấy nói hết đã.'],
        apply: (f) => {
          f.reported = false
        },
      },
    ],
  }
}

/** Đặc vụ xông vào khi Thợ May đang đứng ở quầy */
export function agentFinaleLines(): string[] {
  return [
    'Đừng ai cử động. Chủ quán, kẻ đứng trước quầy anh là Thợ May.',
    'Ba trăm đô tiền thưởng. Huy chương Thanh Lọc. Quán anh thành Trạm Kiểm Soát số 7, có lương tháng.',
    'Hoặc anh phục vụ hắn, và tôi gạch tên anh khỏi sổ. Tôi không có quyền bắn thú thật. Chưa có.',
    'Tôi đứng đây xem. Quyết định đi.',
  ]
}

export function agentAfterFinale(ending: Ending): string[] {
  if (ending === 'tailor') {
    return [
      '...Vậy đấy.',
      'Tôi sẽ viết trong báo cáo là hắn chưa từng tới. Không phải vì anh. Vì nếu viết thật, tôi mất việc trước anh.',
      'Mai tôi không ghé nữa. Giữ quán cho tử tế.',
    ]
  }
  return [
    'Tốt. Mười hai cái bóng ngoài kia sẽ không có costume tối nay.',
    'Huy chương sẽ gửi tới trong tuần. Từ mai nhớ treo biển mới: Trạm Kiểm Soát số 7.',
    'Chúc mừng, chủ quán. Anh đã an toàn. Theo cách của chúng tôi.',
  ]
}

export function endingText(ending: Ending | null): { kicker: string; title: string; lead: string } {
  if (ending === 'tailor') {
    return {
      kicker: 'Kết thúc: cửa kho',
      title: 'Quán vẫn là quán',
      lead: 'Đêm đó cửa kho mở hé. Mười hai cái bóng đi qua, bốn cái thấp hơn mặt quầy. Sáng hôm sau không ai tới kiểm tra. Lửng giữ lời: trong báo cáo, Thợ May chưa từng tồn tại. Còn anh có một quán bar, 500 đô, và một bí mật.',
    }
  }
  if (ending === 'bureau') {
    return {
      kicker: 'Kết thúc: huy chương',
      title: 'Trạm Kiểm Soát số 7',
      lead: 'Thợ May gục trước quầy, không một đường khóa kéo nào lộ ra. Lửng gắn huy chương lên ngực anh và dán quyết định lên cửa. Khách bớt cười. Rượu vẫn bán được. Ngoài kia, mười hai cái bóng đợi một người thợ không bao giờ tới.',
    }
  }
  return {
    kicker: 'Tuần đầu tiên',
    title: 'Bạn sống sót',
    lead: 'Quán vẫn mở cửa sau 7 ngày. Thợ May không tới, hoặc tới mà anh không nhận ra. Lửng vẫn ghé mỗi sáng. Có lẽ là tuần sau.',
  }
}

export function mayorShotReason(): string {
  return 'Bạn vừa bắn thị trưởng Gấu trước mặt cả quán. Ba đời làm gấu. Cục Kiểm Soát không cứu nổi anh, và cũng không muốn.'
}
