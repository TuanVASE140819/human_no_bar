import { JUKEBOX } from '@/data/music'

/** Phần API YouTube IFrame mà game dùng */
interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  mute(): void
  unMute(): void
  getPlayerState(): number
  destroy(): void
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string
      videoId: string
      width: number
      height: number
      playerVars: Record<string, string | number>
      events: {
        onReady?: () => void
        onError?: (e: { data: number }) => void
        onStateChange?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const PLAYING = 1

/**
 * "TV của quán": trình phát YouTube nhúng chính thức, luôn hiển thị (điều khoản YouTube không cho phát ẩn).
 * Bắt đầu phát trong cử chỉ người dùng (bấm Mở cửa). Lỗi tải hoặc video chặn nhúng -> onFail để game lùi về nhạc tổng hợp.
 */
export class Jukebox {
  ready = false
  failed = false
  /** Mã lỗi YouTube gần nhất (2 tham số sai, 5 lỗi trình phát, 100 không tìm thấy, 101/150 chủ kênh tắt nhúng) */
  lastError = 0
  private player: YTPlayer | null = null
  private state = -1
  private wantPlay = false
  private muted = false
  onFail: (() => void) | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly mount: HTMLElement,
  ) {}

  get enabled(): boolean {
    return JUKEBOX.videoId.length > 0 && !this.failed
  }

  get playing(): boolean {
    return this.state === PLAYING
  }

  /** Nạp API YouTube và tạo trình phát. Trả về true nếu sẵn sàng trong vòng 10 giây. */
  load(): Promise<boolean> {
    if (!this.enabled) return Promise.resolve(false)
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        window.clearTimeout(timer)
        if (!ok) this.fail()
        resolve(ok)
      }
      const timer = window.setTimeout(() => done(false), 10000)
      const create = () => {
        const YT = window.YT
        if (!YT) {
          done(false)
          return
        }
        try {
          this.player = new YT.Player(this.mount, {
            host: 'https://www.youtube-nocookie.com',
            videoId: JUKEBOX.videoId,
            width: 240,
            height: 200,
            playerVars: {
              controls: 1,
              rel: 0,
              playsinline: 1,
              loop: 1,
              playlist: JUKEBOX.videoId,
              origin: location.origin,
            },
            events: {
              onReady: () => {
                this.ready = true
                this.root.classList.remove('hidden')
                if (this.muted) this.player?.mute()
                if (this.wantPlay) this.player?.playVideo()
                done(true)
              },
              onError: (e) => {
                this.lastError = e.data
                console.warn(`YouTube không phát được (mã ${e.data}), dùng nhạc tổng hợp.`)
                done(false)
              },
              onStateChange: (e) => {
                this.state = e.data
              },
            },
          })
        } catch {
          done(false)
        }
      }
      if (window.YT?.Player) {
        create()
        return
      }
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        create()
      }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.onerror = () => done(false)
      document.head.appendChild(s)
    })
  }

  /** Gọi từ một click của người dùng để trình duyệt cho phép phát có tiếng */
  play(): void {
    this.wantPlay = true
    if (this.ready) this.player?.playVideo()
  }

  pause(): void {
    this.wantPlay = false
    this.player?.pauseVideo()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (!this.player) return
    if (m) this.player.mute()
    else this.player.unMute()
  }

  private fail(): void {
    if (this.failed) return
    this.failed = true
    this.root.classList.add('hidden')
    try {
      this.player?.destroy()
    } catch {
      /* đã hủy */
    }
    this.player = null
    this.onFail?.()
  }
}
