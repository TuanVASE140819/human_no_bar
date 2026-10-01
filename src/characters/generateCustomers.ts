import { SPECIES, SPECIES_IDS, type SpeciesDef } from '@/data/species'
import { DRINK_IDS, type DrinkId } from '@/data/drinks'
import { cluesAvailableOnDay, QUIRKS, type ClueId, type Quirk } from '@/data/clues'
import type { DayConfig } from '@/data/difficulty'
import { pick, shuffle, chance } from '@/core/rand'
import { ACCESSORIES, ACCENT_COLORS, type CharacterLook } from './buildCharacter'

export interface CustomerSpec {
  species: SpeciesDef
  isHuman: boolean
  clues: Set<ClueId>
  quirk: Quirk | null
  furColor: number
  look: CharacterLook
  order: DrinkId
  greeting: string
  sloganText: string
  answerText: string
}

/** Phụ kiện ngẫu nhiên cho cá tính; hươu có gạc nên không đội mũ. */
function randomLook(species: SpeciesDef): CharacterLook {
  const options = species.antlers ? ACCESSORIES.filter((a) => a !== 'hat' && a !== 'beret') : ACCESSORIES
  return { accessory: chance(0.65) ? pick(options) : null, accent: pick(ACCENT_COLORS) }
}

const GREETINGS = [
  'Chào ông chủ.',
  'Chiều nay nóng thật.',
  'Quán đông nhỉ.',
  'Lâu rồi mới ghé.',
  'Xin chào.',
  'Mệt quá đi mất.',
  'Cho tôi ngồi một lát.',
  'Hôm nay có gì mới không?',
]

function randomSpecies(): SpeciesDef {
  return SPECIES[pick(SPECIES_IDS)]
}

function makeAnimal(): CustomerSpec {
  const species = randomSpecies()
  const order: DrinkId = chance(0.8)
    ? species.favoriteDrink
    : pick(DRINK_IDS.filter((d) => d !== species.favoriteDrink))
  return {
    species,
    isHuman: false,
    clues: new Set(),
    quirk: null,
    furColor: species.furColor,
    look: randomLook(species),
    order,
    greeting: pick(GREETINGS),
    sloganText: species.slogan,
    answerText: species.answer,
  }
}

function makeHuman(cfg: DayConfig): CustomerSpec {
  const species = randomSpecies()
  const available = cluesAvailableOnDay(cfg.day)
  const target = Math.min(3, cfg.minClues + (chance(0.35) ? 1 : 0))
  const chosen = new Set<ClueId>()
  // Luôn có ít nhất một manh mối đủ để kết luận
  chosen.add(pick(available.filter((c) => c.conclusive)).id)
  for (const c of shuffle(available.filter((c) => !chosen.has(c.id)))) {
    if (chosen.size >= target) break
    chosen.add(c.id)
  }
  return {
    species,
    isHuman: true,
    clues: chosen,
    quirk: null,
    furColor: chosen.has('wrongFur') ? pick(species.wrongFurColors) : species.furColor,
    look: randomLook(species),
    order: chosen.has('wrongDrink')
      ? pick(DRINK_IDS.filter((d) => d !== species.favoriteDrink))
      : species.favoriteDrink,
    greeting: pick(GREETINGS),
    sloganText: chosen.has('wrongSlogan') ? pick(species.wrongSlogans) : species.slogan,
    answerText: chosen.has('wrongAnswer') ? pick(species.wrongAnswers) : species.answer,
  }
}

/** Khách mẫu cho màn trưng bày (?lineup): thú thật hoặc người giả mang đủ manh mối thị giác. */
export function showcaseSpec(species: SpeciesDef, isHuman: boolean): CustomerSpec {
  const clues = new Set<ClueId>(isHuman ? ['zipper', 'earOff', 'fiveFingers', 'humanShoes', 'plasticEyes'] : [])
  return {
    species,
    isHuman,
    clues,
    quirk: null,
    furColor: species.furColor,
    look: randomLook(species),
    order: species.favoriteDrink,
    greeting: pick(GREETINGS),
    sloganText: species.slogan,
    answerText: species.answer,
  }
}

export function generateDayCustomers(cfg: DayConfig, count: number): CustomerSpec[] {
  const total = Math.max(4, count)
  const humanCount = Math.max(1, Math.round(total * cfg.humanRate))
  const flags = shuffle(Array.from({ length: total }, (_, i) => i < humanCount))
  if (cfg.day === 1 && flags[0]) {
    const j = flags.findIndex((f) => !f)
    if (j > 0) {
      flags[0] = false
      flags[j] = true
    }
  }
  const specs = flags.map((isHuman) => (isHuman ? makeHuman(cfg) : makeAnimal()))

  const animals = shuffle(specs.filter((s) => !s.isHuman))
  for (let i = 0; i < Math.min(cfg.decoys, animals.length); i++) {
    animals[i].quirk = QUIRKS[i % QUIRKS.length]
  }
  return specs
}
