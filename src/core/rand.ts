export function rand(min = 0, max = 1): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function chance(p: number): boolean {
  return Math.random() < p
}
