/**
 * Âm thanh tổng hợp hoàn toàn bằng WebAudio, không cần file: tiếng súng, chuông cửa, bước chân,
 * ly chạm, tiền, chữ chạy, và nhạc nền lo-fi jazz vòng lặp.
 * AudioContext chỉ được tạo sau một cử chỉ của người dùng (unlock), nên không có cảnh báo của trình duyệt.
 */

const STORAGE_KEY = 'nhb.muted'

type OscType = OscillatorType
type FilterType = BiquadFilterType

interface ToneOpts {
  type?: OscType
  freqEnd?: number
  attack?: number
  filter?: { type: FilterType; freq: number; freqEnd?: number; q?: number }
  detune?: number
  at?: number
}

interface BurstOpts {
  filter?: { type: FilterType; freq: number; freqEnd?: number; q?: number }
  at?: number
}

// Hợp âm lo-fi (MIDI): bass + voicing pad không gốc, 1 ô nhịp mỗi hợp âm
const CHORDS = [
  { bass: 38, notes: [57, 60, 64, 65] }, // Dm9
  { bass: 43, notes: [59, 64, 65, 69] }, // G13
  { bass: 36, notes: [55, 59, 62, 64] }, // Cmaj9
  { bass: 45, notes: [55, 59, 60, 64] }, // Am9
]

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12)
}

class AudioSystem {
  muted = false

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private musicTimer: number | null = null
  private nextBeat = 0
  private beat = 0

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      /* bộ nhớ trình duyệt bị chặn */
    }
  }

  /** Gọi trong một click hoặc phím bấm: tạo và mở AudioContext. Gọi nhiều lần không sao. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(ctx.destination)
      this.sfxBus = ctx.createGain()
      this.sfxBus.gain.value = 0.9
      this.sfxBus.connect(this.master)
      this.musicBus = ctx.createGain()
      this.musicBus.gain.value = 0.3
      this.musicBus.connect(this.master)
      const len = ctx.sampleRate * 2
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 1
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0')
    } catch {
      /* bỏ qua */
    }
    return this.muted
  }

  // ---------- Hiệu ứng ----------

  gunshot(): void {
    if (!this.on()) return
    this.burst(0.38, 1.0, { filter: { type: 'lowpass', freq: 4200, freqEnd: 220 } })
    this.burst(0.03, 0.9, { filter: { type: 'highpass', freq: 3000 } })
    this.tone(95, 0.26, 0.9, { type: 'sine', freqEnd: 38 })
  }

  bell(): void {
    if (!this.on()) return
    this.tone(1568, 0.5, 0.22, { type: 'sine' })
    this.tone(3136, 0.3, 0.06, { type: 'sine' })
    this.tone(1319, 0.6, 0.2, { type: 'sine', at: 0.13 })
  }

  creak(soft = false): void {
    if (!this.on()) return
    this.tone(140, 0.35, soft ? 0.05 : 0.09, {
      type: 'sawtooth',
      freqEnd: 170,
      attack: 0.05,
      filter: { type: 'lowpass', freq: 700 },
    })
  }

  footstep(volume = 1): void {
    if (!this.on()) return
    const v = Math.min(1, Math.max(0, volume))
    this.burst(0.06, 0.22 * v, { filter: { type: 'bandpass', freq: 320 + Math.random() * 160, q: 1.2 } })
    this.tone(85, 0.08, 0.14 * v, { type: 'sine', freqEnd: 60 })
  }

  clink(): void {
    if (!this.on()) return
    this.tone(2637, 0.16, 0.22, { type: 'sine' })
    this.tone(3520, 0.12, 0.14, { type: 'sine', detune: 8 })
    this.tone(1319, 0.22, 0.09, { type: 'triangle' })
  }

  coin(): void {
    if (!this.on()) return
    this.tone(988, 0.14, 0.16, { type: 'sine' })
    this.tone(1319, 0.14, 0.16, { type: 'sine', at: 0.07 })
    this.tone(1760, 0.22, 0.16, { type: 'sine', at: 0.14 })
  }

  bad(): void {
    if (!this.on()) return
    this.tone(110, 0.36, 0.16, { type: 'square', filter: { type: 'lowpass', freq: 700 } })
    this.tone(116, 0.36, 0.1, { type: 'square', filter: { type: 'lowpass', freq: 700 } })
  }

  blip(): void {
    if (!this.on()) return
    this.tone(1250 + Math.random() * 300, 0.03, 0.045, { type: 'square', filter: { type: 'lowpass', freq: 2600 } })
  }

  thud(): void {
    if (!this.on()) return
    this.burst(0.18, 0.5, { filter: { type: 'lowpass', freq: 280 } })
    this.tone(60, 0.22, 0.6, { type: 'sine', freqEnd: 34 })
  }

  // ---------- Nhạc nền ----------

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return
    this.beat = 0
    this.nextBeat = this.ctx.currentTime + 0.15
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90)
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  private scheduleMusic(): void {
    if (!this.ctx || this.ctx.state !== 'running') return
    const beatLen = 60 / 84
    while (this.nextBeat < this.ctx.currentTime + 0.3) {
      if (!this.muted) this.playBeat(this.beat, this.nextBeat, beatLen)
      this.beat += 1
      this.nextBeat += beatLen
    }
  }

  private playBeat(beat: number, t: number, len: number): void {
    const bus = this.musicBus
    if (!bus) return
    const inBar = beat % 4
    const chord = CHORDS[Math.floor(beat / 4) % CHORDS.length]

    // Pad: mỗi ô nhịp một hợp âm, triangle qua lowpass, vào chậm ra chậm
    if (inBar === 0) {
      for (const n of chord.notes) {
        this.tone(midi(n), len * 4 + 0.5, 0.045, {
          type: 'triangle',
          attack: 0.5,
          detune: (Math.random() - 0.5) * 8,
          filter: { type: 'lowpass', freq: 1100 },
          at: t,
          dest: bus,
        } as ToneOpts & { dest: GainNode })
      }
    }
    // Bass: phách 1 và 3, phách 4 lên quãng năm
    if (inBar === 0 || inBar === 2) this.tone(midi(chord.bass), 0.5, 0.3, { type: 'sine', at: t, dest: bus } as ToneOpts & { dest: GainNode })
    if (inBar === 3) this.tone(midi(chord.bass + 7), 0.3, 0.18, { type: 'sine', at: t + len * 0.5, dest: bus } as ToneOpts & { dest: GainNode })
    // Trống lo-fi: kick 1 & 3, snare 2 & 4, hi-hat móc đơn có swing
    if (inBar === 0 || inBar === 2) this.tone(110, 0.14, 0.4, { type: 'sine', freqEnd: 45, at: t, dest: bus } as ToneOpts & { dest: GainNode })
    if (inBar === 1 || inBar === 3) {
      this.burst(0.09, 0.2, { filter: { type: 'bandpass', freq: 1800, q: 0.8 }, at: t, dest: bus } as BurstOpts & { dest: GainNode })
    }
    this.burst(0.025, 0.07, { filter: { type: 'highpass', freq: 7000 }, at: t, dest: bus } as BurstOpts & { dest: GainNode })
    this.burst(0.02, 0.045, { filter: { type: 'highpass', freq: 7000 }, at: t + len * 0.66, dest: bus } as BurstOpts & { dest: GainNode })
    // Giai điệu thưa: ngẫu nhiên một nốt trong hợp âm lên một quãng tám
    if ((inBar === 1 || inBar === 3) && Math.random() < 0.45) {
      const n = chord.notes[Math.floor(Math.random() * chord.notes.length)] + 12
      this.tone(midi(n), 0.6, 0.1, { type: 'triangle', at: t + (Math.random() < 0.5 ? 0 : len * 0.66), filter: { type: 'lowpass', freq: 2400 }, dest: bus } as ToneOpts & { dest: GainNode })
    }
    // Tiếng rè đĩa than
    for (let i = 0; i < 2; i++) {
      this.burst(0.004, 0.03, { filter: { type: 'highpass', freq: 2500 }, at: t + Math.random() * len, dest: bus } as BurstOpts & { dest: GainNode })
    }
  }

  // ---------- Khối tạo âm ----------

  private on(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted
  }

  private tone(freq: number, dur: number, gain: number, o: ToneOpts & { dest?: GainNode } = {}): void {
    const ctx = this.ctx
    const dest = o.dest ?? this.sfxBus
    if (!ctx || !dest) return
    const t0 = o.at !== undefined && o.at > ctx.currentTime ? o.at : ctx.currentTime + (o.at ?? 0)
    const osc = ctx.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + dur)
    if (o.detune) osc.detune.value = o.detune
    const g = ctx.createGain()
    const attack = o.attack ?? 0.004
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    let node: AudioNode = osc
    if (o.filter) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter.type
      f.frequency.setValueAtTime(o.filter.freq, t0)
      if (o.filter.freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(o.filter.freqEnd, t0 + dur)
      if (o.filter.q !== undefined) f.Q.value = o.filter.q
      node.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(dest)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private burst(dur: number, gain: number, o: BurstOpts & { dest?: GainNode } = {}): void {
    const ctx = this.ctx
    const dest = o.dest ?? this.sfxBus
    if (!ctx || !dest || !this.noise) return
    const t0 = o.at !== undefined && o.at > ctx.currentTime ? o.at : ctx.currentTime + (o.at ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    let node: AudioNode = src
    if (o.filter) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter.type
      f.frequency.setValueAtTime(o.filter.freq, t0)
      if (o.filter.freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(o.filter.freqEnd, t0 + dur)
      if (o.filter.q !== undefined) f.Q.value = o.filter.q
      node.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(dest)
    src.start(t0, Math.random() * 1.5)
    src.stop(t0 + dur + 0.05)
  }
}

export const sfx = new AudioSystem()
