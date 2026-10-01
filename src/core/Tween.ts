export type Ease = (t: number) => number

export const Easing = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
}

export interface TweenOptions {
  duration: number
  delay?: number
  ease?: Ease
  onUpdate?: (t: number) => void
  onComplete?: () => void
}

export interface TweenHandle {
  cancel(): void
  readonly done: boolean
}

interface TweenItem extends TweenOptions {
  elapsed: number
  delayLeft: number
  done: boolean
}

export class Tweens {
  private items: TweenItem[] = []

  add(opts: TweenOptions): TweenHandle {
    const item: TweenItem = { ...opts, elapsed: 0, delayLeft: opts.delay ?? 0, done: false }
    this.items.push(item)
    return {
      cancel: () => {
        item.done = true
      },
      get done() {
        return item.done
      },
    }
  }

  delay(seconds: number, cb: () => void): TweenHandle {
    return this.add({ duration: 0, delay: seconds, onComplete: cb })
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (it.done) continue
      if (it.delayLeft > 0) {
        it.delayLeft -= dt
        if (it.delayLeft > 0) continue
      }
      it.elapsed += dt
      const raw = it.duration <= 0 ? 1 : Math.min(1, it.elapsed / it.duration)
      const t = (it.ease ?? Easing.linear)(raw)
      it.onUpdate?.(t)
      if (raw >= 1) {
        it.done = true
        it.onComplete?.()
      }
    }
    if (this.items.length > 64) this.items = this.items.filter((i) => !i.done)
  }

  clear(): void {
    this.items = []
  }
}

export const tweens = new Tweens()
