/**
 * Âm thanh tổng hợp hoàn toàn bằng WebAudio, không cần file: tiếng súng, chuông cửa, bước chân,
 * ly chạm, tiền, chữ chạy, và nhạc nền lo-fi jazz vòng lặp.
 * AudioContext chỉ được tạo sau một cử chỉ của người dùng (unlock), nên không có cảnh báo của trình duyệt.
 */

import { BALLAD, VOICINGS } from '@/data/music'

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

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12)
}

interface MelodyEvent {
  /** Phách bắt đầu trong vòng lặp */
  start: number
  midi: number
  beats: number
}

class AudioSystem {
  muted = false
  /** Gọi đúng lúc một nốt saxophone vang lên (để nhạc công cử động theo) */
  onNote: ((midi: number, seconds: number) => void) | null = null

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private musicTimer: number | null = null
  private nextBeat = 0
  private beat = 0
  private readonly melody: MelodyEvent[] = []
  private readonly loopBeats: number

  /** File nhạc riêng (nếu có): dữ liệu thô, buffer đã giải mã, nguồn đang phát, bộ đo mức */
  private trackData: ArrayBuffer | null = null
  private track: AudioBuffer | null = null
  private trackSource: AudioBufferSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private levelBuf: Uint8Array<ArrayBuffer> | null = null

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      /* bộ nhớ trình duyệt bị chặn */
    }
    let start = 0
    for (const [m, beats] of BALLAD.melody) {
      this.melody.push({ start, midi: m, beats })
      start += beats
    }
    this.loopBeats = BALLAD.chords.length * 2
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

  /** Rót nước: tiếng ồn qua bandpass hạ dần + nốt sine cao dần (gọi lặp mỗi nửa giây khi đang châm) */
  pour(): void {
    if (!this.on()) return
    this.burst(0.5, 0.22, { filter: { type: 'bandpass', freq: 1100, freqEnd: 650, q: 1.1 } })
    this.tone(320, 0.5, 0.05, { type: 'sine', freqEnd: 520 })
  }

  /** Gõ cửa kho ba tiếng khi hàng tới */
  knock(): void {
    if (!this.on()) return
    for (let i = 0; i < 3; i++) {
      this.burst(0.08, 0.45, { filter: { type: 'lowpass', freq: 220 }, at: i * 0.24 })
      this.tone(90, 0.1, 0.3, { type: 'sine', freqEnd: 60, at: i * 0.24 })
    }
  }

  // ---------- Nhạc sống: file riêng (nếu có) hoặc Vịt Sax chơi bản ballad tổng hợp ----------

  /**
   * Thử tải file nhạc riêng: lần lượt các đường dẫn đưa vào (public/audio/ballad.mp3 / .ogg / .wav).
   * Chỉ dùng bản thu bạn có quyền sử dụng. Không có file thì game dùng bản ballad tổng hợp.
   * Trả về đường dẫn đã nhận, hoặc null.
   */
  async preloadTrack(urls: string[]): Promise<string | null> {
    for (const url of urls) {
      try {
        const res = await fetch(url)
        if (!res.ok || res.status === 204) continue
        const type = res.headers.get('content-type') ?? ''
        if (/text\/html/i.test(type)) continue
        const data = await res.arrayBuffer()
        if (data.byteLength < 1024) continue
        this.trackData = data
        return url
      } catch {
        /* thử đường dẫn tiếp theo */
      }
    }
    return null
  }

  /** Đang phát file nhạc riêng (thay vì bản tổng hợp) */
  get usingTrack(): boolean {
    return this.trackSource !== null
  }

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null || this.trackSource) return
    if (this.trackData) {
      void this.startTrack()
      return
    }
    this.beat = 0
    this.nextBeat = this.ctx.currentTime + 0.2
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90)
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
    if (this.trackSource) {
      try {
        this.trackSource.stop()
      } catch {
        /* đã dừng */
      }
      this.trackSource = null
      this.analyser = null
    }
  }

  private async startTrack(): Promise<void> {
    const ctx = this.ctx
    const bus = this.musicBus
    if (!ctx || !bus || !this.trackData) return
    if (!this.track) {
      try {
        this.track = await ctx.decodeAudioData(this.trackData.slice(0))
      } catch (err) {
        console.warn('Không giải mã được file nhạc, dùng bản tổng hợp.', err)
        this.trackData = null
        this.startMusic()
        return
      }
    }
    if (this.trackSource) return
    const src = ctx.createBufferSource()
    src.buffer = this.track
    src.loop = true
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.55
    src.connect(analyser)
    analyser.connect(bus)
    src.start()
    this.trackSource = src
    this.analyser = analyser
    this.levelBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
  }

  /** Mức âm lượng dải trầm-trung của file nhạc đang phát (0..1); 0 khi không phát file */
  level(): number {
    if (!this.analyser || !this.levelBuf || this.muted) return 0
    this.analyser.getByteFrequencyData(this.levelBuf)
    const n = Math.min(28, this.levelBuf.length)
    let sum = 0
    for (let i = 2; i < n; i++) sum += this.levelBuf[i]
    return sum / ((n - 2) * 255)
  }

  private scheduleMusic(): void {
    if (!this.ctx || this.ctx.state !== 'running') return
    const beatLen = 60 / BALLAD.bpm
    while (this.nextBeat < this.ctx.currentTime + 0.35) {
      if (!this.muted) this.playBeat(this.beat, this.nextBeat, beatLen)
      this.beat += 1
      this.nextBeat += beatLen
    }
  }

  private playBeat(beat: number, t: number, len: number): void {
    const bus = this.musicBus
    if (!bus) return
    const b = beat % this.loopBeats
    const inBar = b % 4
    const chord = VOICINGS[BALLAD.chords[Math.floor(b / 2)]] ?? VOICINGS.Am9

    // Pad đổi mỗi hợp âm (2 phách): triangle qua lowpass, vào chậm ra chậm
    if (b % 2 === 0) {
      for (const n of chord.notes) {
        this.tone(midi(n), len * 2 + 0.7, 0.036, {
          type: 'triangle',
          attack: 0.55,
          detune: (Math.random() - 0.5) * 8,
          filter: { type: 'lowpass', freq: 1000 },
          at: t,
          dest: bus,
        } as ToneOpts & { dest: GainNode })
      }
    }
    // Bass contrabass: phách 1 và 3
    if (inBar === 0 || inBar === 2) {
      this.tone(midi(chord.bass), len * 1.6, 0.26, { type: 'sine', attack: 0.02, at: t, dest: bus } as ToneOpts & { dest: GainNode })
      this.tone(midi(chord.bass), 0.12, 0.06, { type: 'triangle', at: t, dest: bus } as ToneOpts & { dest: GainNode })
    }
    // Chổi trống: mỗi phách, đảo phách nhẹ có swing; rim click 2 & 4
    this.burst(0.03, 0.03, { filter: { type: 'highpass', freq: 8000 }, at: t, dest: bus } as BurstOpts & { dest: GainNode })
    this.burst(0.025, 0.018, { filter: { type: 'highpass', freq: 8000 }, at: t + len * 0.66, dest: bus } as BurstOpts & { dest: GainNode })
    if (inBar === 1 || inBar === 3) {
      this.burst(0.025, 0.07, { filter: { type: 'bandpass', freq: 2600, q: 1.5 }, at: t, dest: bus } as BurstOpts & { dest: GainNode })
    }
    // Giai điệu saxophone: các nốt bắt đầu trong phách này
    for (const ev of this.melody) {
      if (ev.start < b || ev.start >= b + 1) continue
      if (ev.midi <= 0) continue
      const at = t + (ev.start - b) * len
      const seconds = ev.beats * len * 0.95
      this.sax(midi(ev.midi), seconds, 0.2, at)
      this.fireNote(ev.midi, seconds, at)
    }
    // Tiếng rè đĩa than rất nhẹ
    this.burst(0.004, 0.025, { filter: { type: 'highpass', freq: 2500 }, at: t + Math.random() * len, dest: bus } as BurstOpts & { dest: GainNode })
  }

  private fireNote(m: number, seconds: number, at: number): void {
    if (!this.onNote || !this.ctx) return
    const delay = Math.max(0, (at - this.ctx.currentTime) * 1000)
    const cb = this.onNote
    window.setTimeout(() => cb(m, seconds), delay)
  }

  /**
   * Saxophone tổng hợp: hai răng cưa lệch nhẹ + thân trầm, rung (vibrato) vào dần,
   * lowpass mở ra lúc bắt đầu rồi khép lại, formant quanh 1,1 kHz, hơi thở ở đầu nốt.
   */
  private sax(freq: number, dur: number, gain: number, at: number): void {
    const ctx = this.ctx
    const dest = this.musicBus
    if (!ctx || !dest) return
    const t0 = at
    const o1 = ctx.createOscillator()
    o1.type = 'sawtooth'
    o1.frequency.value = freq
    const o2 = ctx.createOscillator()
    o2.type = 'sawtooth'
    o2.frequency.value = freq
    o2.detune.value = 7
    const o3 = ctx.createOscillator()
    o3.type = 'square'
    o3.frequency.value = freq / 2
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 5.2
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(0, t0)
    lfoGain.gain.linearRampToValueAtTime(freq * 0.007, t0 + Math.min(0.5, dur * 0.5))
    lfo.connect(lfoGain)
    lfoGain.connect(o1.frequency)
    lfoGain.connect(o2.frequency)
    const mix = ctx.createGain()
    const sub = ctx.createGain()
    sub.gain.value = 0.18
    o1.connect(mix)
    o2.connect(mix)
    o3.connect(sub)
    sub.connect(mix)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.9
    lp.frequency.setValueAtTime(freq * 1.8, t0)
    lp.frequency.exponentialRampToValueAtTime(Math.min(7000, freq * 4.5), t0 + 0.12)
    lp.frequency.exponentialRampToValueAtTime(Math.min(5000, freq * 3), t0 + Math.max(0.2, dur - 0.1))
    const formant = ctx.createBiquadFilter()
    formant.type = 'peaking'
    formant.frequency.value = 1100
    formant.Q.value = 1.2
    formant.gain.value = 7
    const amp = ctx.createGain()
    const rel = Math.min(0.18, dur * 0.3)
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.07)
    amp.gain.setValueAtTime(gain, t0 + Math.max(0.07, dur - rel))
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    mix.connect(lp)
    lp.connect(formant)
    formant.connect(amp)
    amp.connect(dest)
    for (const o of [o1, o2, o3, lfo]) {
      o.start(t0)
      o.stop(t0 + dur + 0.05)
    }
    this.burst(0.12, gain * 0.35, { filter: { type: 'bandpass', freq: 2200, q: 0.7 }, at: t0, dest } as BurstOpts & { dest: GainNode })
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
