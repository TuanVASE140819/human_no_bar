export interface DayConfig {
  day: number
  customers: number
  humanRate: number
  minClues: number
  decoys: number
  news: string[]
}

export const TOTAL_DAYS = 7

export const DAYS: DayConfig[] = [
  {
    day: 1,
    customers: 8,
    humanRate: 0.15,
    minClues: 3,
    decoys: 0,
    news: [
      'Ngày đầu mở quán. Cảnh sát thành phố báo có người trà trộn, tỷ lệ thấp.',
      'Hướng dẫn: nhìn tai, so màu lông, nghe khách gọi món. Q để yêu cầu khách quay người.',
    ],
  },
  {
    day: 2,
    customers: 10,
    humanRate: 0.2,
    minClues: 3,
    decoys: 1,
    news: [
      'Một số người bắt đầu mặc costume kỹ hơn. Hãy soi bàn tay và giày.',
      'Lưu ý: vài khách thật bị thương hoặc đeo kính. Đó không phải manh mối.',
    ],
  },
  {
    day: 3,
    customers: 12,
    humanRate: 0.25,
    minClues: 2,
    decoys: 1,
    news: [
      'Người giả đã học thuộc khẩu hiệu. Hãy thử câu hỏi loài (Q → 3).',
      'Mắt nhựa không chớp. Nhìn thẳng vào mắt khách vài giây.',
    ],
  },
  {
    day: 4,
    customers: 12,
    humanRate: 0.3,
    minClues: 2,
    decoys: 2,
    news: ['Tỷ lệ người trà trộn tăng. Nhiều kẻ chỉ còn hai sơ hở.'],
  },
  {
    day: 5,
    customers: 14,
    humanRate: 0.3,
    minClues: 2,
    decoys: 2,
    news: ['Quán đông hơn. Đừng để khách chờ quá lâu.'],
  },
  {
    day: 6,
    customers: 14,
    humanRate: 0.35,
    minClues: 1,
    decoys: 3,
    news: ['Cảnh báo: một số kẻ chỉ có một sơ hở duy nhất. Kiểm tra kỹ trước khi bắn.'],
  },
  {
    day: 7,
    customers: 16,
    humanRate: 0.4,
    minClues: 1,
    decoys: 3,
    news: ['Ngày cuối. Gần một nửa khách là người. Sống sót là thắng.'],
  },
]

export function dayConfig(day: number): DayConfig {
  return DAYS[Math.min(day, TOTAL_DAYS) - 1]
}
