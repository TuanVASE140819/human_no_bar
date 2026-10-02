import * as THREE from 'three'
import { Input } from './Input'
import { tweens } from './Tween'
import { pick } from './rand'
import { Player, type Tool } from '@/render/Player'
import { Lighting } from '@/render/Lighting'
import { Effects } from '@/render/Effects'
import { PostFX } from '@/render/PostFX'
import { buildBar, type BarWorld } from '@/world/Bar'
import { Customer, PATIENCE_SECONDS } from '@/characters/Customer'
import { generateDayCustomers, showcaseSpec, type CustomerSpec } from '@/characters/generateCustomers'
import { SPECIES, SPECIES_IDS } from '@/data/species'
import {
  Economy,
  BOUNTY,
  MISFIRE_FINE,
  REP_CATCH,
  REP_MISFIRE,
  REP_SLIPPED,
  REP_SERVED,
  REP_WALKOUT,
  type DayStats,
} from '@/systems/Economy'
import {
  AGENT_NAME,
  STORY_DAYS,
  agentSpec,
  storySpec,
  introLines,
  dailyLines,
  storyLines,
  storyChoice,
  agentFinaleLines,
  agentAfterFinale,
  endingText,
  mayorShotReason,
  newStoryFlags,
  type StoryFlags,
  type StoryChoice,
} from '@/data/story'
import { sfx } from './Audio'
import type { Mood } from '@/characters/buildCharacter'
import { DayClock } from '@/systems/DayClock'
import { dayConfig, TOTAL_DAYS } from '@/data/difficulty'
import { DRINKS, DRINK_IDS, type DrinkId } from '@/data/drinks'
import { Inventory, cratePrice, CRATE_SERVINGS, MAX_STOCK } from '@/systems/Inventory'
import { CLUE_BY_ID, type Quirk } from '@/data/clues'
import { Hud } from '@/ui/Hud'
import { Dialog } from '@/ui/Dialog'
import { RequestMenu } from '@/ui/RequestMenu'
import { Journal } from '@/ui/Journal'
import { Overlay } from '@/ui/Overlay'
import { toast, screenFlash } from '@/ui/Toast'

type GameState = 'menu' | 'morning' | 'open' | 'closing' | 'summary' | 'gameover' | 'win'

/** Vật người chơi đang nhìn vào ở cự ly tương tác */
interface Focus {
  kind: 'crate' | 'dispenser'
  id: DrinkId
}

const FILL_SECONDS = 2.2

const THANKS = ['Cảm ơn ông chủ!', 'Tuyệt. Hẹn gặp lại.', 'Đúng vị. Cảm ơn.', 'Hôm nay ông chủ tử tế ghê.']
const GUN_LINES = [
  'Ơ... súng để làm gì vậy?',
  'Bình tĩnh, tôi chỉ muốn uống thôi.',
  'Tôi là thú thật mà!',
  'Khoan... hạ xuống đã, nói chuyện được không?',
]
const QUIRK_LABEL: Record<Quirk, string> = {
  bandage: 'vết băng bó',
  glasses: 'cặp kính',
  greyPatch: 'mảng lông bạc',
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly input: Input
  private readonly player: Player
  private readonly lighting: Lighting
  private readonly effects: Effects
  private readonly postfx: PostFX
  private readonly bar: BarWorld
  private readonly economy = new Economy()
  private readonly inventory = new Inventory()
  private readonly clock = new DayClock()

  /** Tồn kho: thùng đang vác, tiến độ châm (0..1), vật đang nhìn, menu đặt hàng */
  private carry: DrinkId | null = null
  private fill = 0
  private focus: Focus | null = null
  private orderOpen = false
  private frameDt = 0
  private pourTimer = 0
  private readonly hud = new Hud()
  private readonly dialog = new Dialog()
  private readonly request = new RequestMenu()
  private readonly journal = new Journal()
  private readonly overlay = new Overlay()

  private state: GameState = 'menu'
  private day = 1
  private queue: CustomerSpec[] = []
  private current: Customer | null = null
  /** Khách đang rời quán hoặc đang ngã */
  private readonly others: Customer[] = []
  private spawnTimer = 0
  private closingTimer = 0
  private lastTime = performance.now()
  private totalCaught = 0
  private doorUsers = 0
  private debug = false
  private forceIntro = false
  /** Màn trưng bày nhân vật: không sinh khách, không đóng cửa */
  private lineup = false

  /** Cảnh cốt truyện: đồng hồ dừng, không sinh khách, không bắn; ai đang nói là `speaker` */
  private agent: Customer | null = null
  private cutscene = false
  private lines: string[] = []
  private lineIndex = 0
  private speaker: Customer | null = null
  private speakerName = ''
  private onLinesDone: (() => void) | null = null
  private choice: StoryChoice | null = null
  private storyFlags: StoryFlags = newStoryFlags()
  private storyFirst = false
  private yesterday: DayStats | null = null

  private readonly doorIn = new THREE.Vector3(0.3, 0, -3.6)
  private readonly spawnIn = new THREE.Vector3(0.3, 0, -5.4)
  private readonly doorOut = new THREE.Vector3(-0.3, 0, -3.6)
  private readonly spawnOut = new THREE.Vector3(-0.3, 0, -5.4)

  /** ?hd: giữ nguyên độ phân giải Retina, không tự hạ khi khung hình thấp */
  private readonly hd: boolean
  private fpsTimer = 0
  private fpsFrames = 0

  constructor(canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(location.search)
    this.hd = params.has('hd')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    // Màn Retina (Mac) có dpr 2: bắt đầu ở 1.5 để hậu kỳ nhẹ hơn, tự hạ tiếp nếu khung hình thấp
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.hd ? 2 : 1.5))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.input = new Input(canvas)
    this.player = new Player(window.innerWidth / window.innerHeight)
    this.scene.add(this.player.camera)
    this.lighting = new Lighting(this.scene)
    this.effects = new Effects(this.scene)
    this.bar = buildBar(this.scene)
    for (const lamp of this.bar.lamps) this.lighting.addLamp(lamp)
    this.lighting.update(0)
    this.syncStock()
    this.postfx = new PostFX(this.renderer, this.scene, this.player.camera)
    // ?nofx tắt viền toon và hậu kỳ cho máy yếu
    this.postfx.enabled = !params.has('nofx')

    this.economy.onChange = () => this.refreshHud()
    this.input.onLockChange = (locked) => this.onLockChange(locked)
    window.addEventListener('resize', () => this.onResize())

    this.showMenu()
    requestAnimationFrame((t) => this.frame(t))
  }

  /**
   * Dùng khi chạy kiểm thử headless: bỏ qua menu, mở quán ngay.
   * intro = vẫn chạy cảnh đặc vụ; day = bắt đầu ở ngày đó; storyFirst = khách cốt truyện vào đầu tiên.
   */
  debugStart(intro = false, day = 1, storyFirst = false): void {
    this.debug = true
    this.forceIntro = intro
    this.storyFirst = storyFirst
    // Giao hàng nhanh để kiểm thử
    this.inventory.deliverySeconds = 3
    this.newGame()
    if (day > 1) {
      this.day = Math.min(day, TOTAL_DAYS)
      this.startDay()
    }
    this.openBar()
  }

  /** Xếp 6 loài đứng hàng ngang trước quầy để xem nhân vật; loài lẻ là người giả mang đủ manh mối. */
  debugLineup(): void {
    this.debugStart()
    this.lineup = true
    this.queue = []
    this.hud.setRemaining(0)
    this.player.pitch = -0.1
    SPECIES_IDS.forEach((id, i) => {
      const c = new Customer(showcaseSpec(SPECIES[id], i % 2 === 1), this.scene, new THREE.Vector3(-3.0 + i * 1.2, 0, -0.6))
      c.lookTarget = this.player.camera.position
      c.state = 'waiting'
      c.face(0)
      c.root.rotation.y = 0
      this.others.push(c)
    })
    this.hud.setHint('Trưng bày nhân vật · loài lẻ là người giả')
  }

  // ---------- Vòng đời ----------

  private showMenu(): void {
    this.state = 'menu'
    this.hud.setVisible(false)
    this.dialog.hide()
    this.overlay.showMenu(() => this.newGame())
  }

  private newGame(): void {
    // Được gọi từ click nên mở được âm thanh; chế độ debug không có cử chỉ người dùng thì bỏ qua
    if (!this.debug) {
      sfx.unlock()
      sfx.startMusic()
    }
    this.clearCustomers()
    this.economy.money = 200
    this.economy.reputation = 50
    this.economy.ammo = 6
    this.totalCaught = 0
    this.storyFlags = newStoryFlags()
    this.yesterday = null
    this.inventory.reset()
    this.setCarry(null)
    for (const c of this.bar.crates.slice()) this.bar.removeCrate(c)
    this.syncStock()
    this.day = 1
    this.setTool('hands')
    this.startDay()
  }

  private startDay(): void {
    const cfg = dayConfig(this.day)
    this.economy.newDay()
    this.clock.reset()
    this.lighting.update(0)
    this.bar.setClock(this.clock.minutes)
    const count = Math.round(cfg.customers * this.economy.customerMod)
    this.queue = generateDayCustomers(cfg, count)
    // Khách cốt truyện chen vào hàng chờ của ngày
    const ev = STORY_DAYS[this.day]
    if (ev && !this.lineup) {
      const at = this.storyFirst ? 0 : Math.min(ev.afterCustomers, this.queue.length)
      this.queue.splice(at, 0, storySpec(ev.role))
    }
    this.state = 'morning'
    this.hud.setVisible(false)
    this.dialog.hide()
    this.hud.setDay(this.day, TOTAL_DAYS)
    this.hud.setRemaining(this.queue.length)
    this.refreshHud()
    this.input.releaseLock()
    this.overlay.showMorning(cfg, this.queue.length, this.economy.ammo, () => this.openBar())
  }

  private openBar(): void {
    if (!this.debug) {
      sfx.unlock()
      sfx.startMusic()
    }
    this.overlay.hide()
    this.state = 'open'
    this.hud.setVisible(true)
    this.hud.setTime(this.clock.label)
    this.spawnTimer = 1.2
    this.input.requestLock()
    this.setHint()
    toast(`Ngày ${this.day}. Mở cửa.`, 'info', 2.5)
    if (!this.lineup && (!this.debug || this.forceIntro)) this.startVisit()
  }

  // ---------- Cốt truyện: đặc vụ ghé quán ----------

  /** Đặc vụ ghé buổi sáng: vào tới quầy, nói, rồi đi. */
  private startVisit(): void {
    const lines = this.day === 1 ? introLines() : dailyLines(this.day, this.yesterday, this.storyFlags)
    const a = this.spawnAgent(this.bar.counterSpot, () => this.startLines(a, AGENT_NAME, lines, () => this.endVisit()))
    this.hud.setHint('Đặc vụ đang vào...')
  }

  /** Đặc vụ bước vào và đi tới điểm `to`; cảnh cốt truyện bật ngay từ lúc mở cửa. */
  private spawnAgent(to: THREE.Vector3, onArrive: () => void): Customer {
    this.cutscene = true
    const a = new Customer(agentSpec(), this.scene, this.spawnIn)
    a.lookTarget = this.player.camera.position
    a.patience = Infinity
    this.agent = a
    this.useDoor(true)
    a.walkTo(this.doorIn, () => {
      this.useDoor(false)
      a.walkTo(to, () => {
        if (this.agent !== a) return
        a.state = 'waiting'
        a.face(0)
        onArrive()
      })
    })
    return a
  }

  /** Một nhân vật nói một chuỗi câu (chữ chạy, E để tiếp); xong gọi onDone. */
  private startLines(speaker: Customer, name: string, lines: string[], onDone: () => void): void {
    this.cutscene = true
    this.speaker = speaker
    this.speakerName = name
    this.lines = lines
    this.lineIndex = 0
    this.onLinesDone = onDone
    this.showLine(0)
  }

  private showLine(i: number): void {
    const s = this.speaker
    if (!s) return
    this.lineIndex = i
    const line = this.lines[i]
    this.dialog.say(this.speakerName, line, true)
    this.dialog.setPrompt(true)
    this.dialog.setPatience(null)
    s.talk(Math.min(4, 0.6 + line.length / 42))
    this.hud.setHint('<b>E</b> hoặc <b>chuột trái</b> để tiếp · <b>Tab</b> sổ tay')
  }

  private advanceLine(): void {
    if (this.dialog.isTyping) {
      this.dialog.finish()
      return
    }
    if (this.lineIndex + 1 < this.lines.length) {
      this.showLine(this.lineIndex + 1)
      return
    }
    this.dialog.setPrompt(false)
    const done = this.onLinesDone
    this.onLinesDone = null
    done?.()
  }

  /** Đặc vụ rời quán, ca làm bắt đầu. */
  private endVisit(): void {
    this.cutscene = false
    this.speaker = null
    tweens.delay(1.2, () => {
      if (!this.current) this.dialog.hide()
    })
    this.dismissAgent()
    this.spawnTimer = 2.0
    if (this.day === 1) toast('Nhiệm vụ: trụ 7 ngày. Không để người lọt.', 'info', 4)
    this.setHint()
  }

  private dismissAgent(): void {
    const a = this.agent
    if (!a) return
    a.state = 'leaving'
    a.walkTo(this.doorOut, () => {
      this.useDoor(true)
      a.walkTo(this.spawnOut, () => {
        this.useDoor(false)
        a.remove()
        if (this.agent === a) this.agent = null
      })
    })
  }

  // ---------- Cốt truyện: khách đặc biệt giữa ngày ----------

  /** Khách cốt truyện vừa tới quầy và nói xong phần của mình. */
  private afterStoryLines(c: Customer): void {
    const role = c.spec.story
    if (role === 'informant') {
      const ch = storyChoice(role)
      if (ch) {
        this.offerChoice(c, ch)
        return
      }
    }
    if (role === 'tailor') {
      this.startFinale(c)
      return
    }
    this.becomeRegular(c, role === 'mayor')
  }

  private offerChoice(c: Customer, ch: StoryChoice): void {
    this.choice = ch
    this.speaker = c
    this.request.open(
      ch.options.map((o, i) => ({ key: String(i + 1), label: o.label })),
      'Trả lời',
    )
    this.hud.setHint('<b>1</b> hoặc <b>2</b> để trả lời')
  }

  private pickChoice(i: number): void {
    const ch = this.choice
    const c = this.speaker
    if (!ch || !c) return
    const opt = ch.options[i]
    if (!opt) return
    this.choice = null
    this.request.close()
    opt.apply(this.storyFlags)
    this.economy.note(`Trả lời chỉ điểm: "${opt.label}"`)
    this.startLines(c, this.claim(c), opt.reply, () => this.becomeRegular(c, false))
  }

  /** Khách cốt truyện trở thành khách bình thường đứng chờ ở quầy (vip = không bao giờ bỏ về). */
  private becomeRegular(c: Customer, vip: boolean): void {
    this.cutscene = false
    this.speaker = null
    c.patience = vip ? Infinity : PATIENCE_SECONDS
    this.dialog.say(this.claim(c), `Cho tôi một ${DRINKS[c.spec.order].name}.`)
    this.dialog.setPatience(vip ? null : 1)
    c.talk(1)
    this.setHint()
  }

  /** Ngày 7: Thợ May đã nói xong, đặc vụ xông vào, đứng cạnh quầy xem người chơi quyết định. */
  private startFinale(tailor: Customer): void {
    tailor.patience = Infinity
    this.dialog.hide()
    this.hud.setHint('Cửa mở...')
    const side = new THREE.Vector3(2.7, 0, -0.3)
    const a = this.spawnAgent(side, () => {
      this.startLines(a, AGENT_NAME, agentFinaleLines(), () => {
        this.cutscene = false
        this.speaker = null
        this.dialog.say(this.claim(tailor), 'Tôi đợi. Nước lã là được.')
        this.dialog.setPatience(null)
        tailor.talk(1)
        this.hud.setHint(
          '<b>E</b> phục vụ Thợ May: để ông ấy đi, nhận $500 · <b>2</b> rồi <b>chuột trái</b>: bắn, nhận $300 · <b>Tab</b> sổ tay',
        )
      })
    })
  }

  /** Người chơi đã quyết định số phận Thợ May; đặc vụ nói lời cuối rồi đi, quán đóng cửa. */
  private agentEpilogue(ending: 'tailor' | 'bureau'): void {
    this.storyFlags.ending = ending
    this.cutscene = true
    this.queue = []
    this.hud.setRemaining(0)
    const a = this.agent
    if (!a) {
      this.finishFinale()
      return
    }
    this.startLines(a, AGENT_NAME, agentAfterFinale(ending), () => this.finishFinale())
  }

  private finishFinale(): void {
    this.cutscene = false
    this.speaker = null
    this.dismissAgent()
    tweens.delay(0.6, () => {
      if (this.state === 'open') this.beginClosing()
    })
  }

  private resolveTailorServed(c: Customer): void {
    this.cutscene = true
    this.economy.earn(500)
    toast('+$500 · Thợ May để lại trên quầy', 'good', 3)
    sfx.clink()
    tweens.delay(0.35, () => sfx.coin())
    this.economy.note('Thợ May: để ông ấy đi. +$500.')
    this.dialog.say(this.claim(c), 'Cảm ơn. Bọn trẻ sẽ thấy biển.')
    this.dialog.setPatience(null)
    c.setMood('neutral')
    c.talk(1.2)
    c.drink(DRINKS.water.color, () => this.leave(c))
    tweens.delay(2.4, () => this.agentEpilogue('tailor'))
  }

  private beginClosing(): void {
    this.state = 'closing'
    this.closingTimer = 0
    this.dialog.hide()
    this.request.close()
    this.journal.close()
    toast('Hết khách. Đóng cửa.', 'info')
  }

  private endDay(): void {
    const st = this.economy.stats
    if (st.slipped > 0) this.economy.addRep(REP_SLIPPED * st.slipped)
    this.clock.finish()
    this.yesterday = { ...st }
    this.state = 'summary'
    this.hud.setVisible(false)
    this.input.releaseLock()
    const isLast = this.day >= TOTAL_DAYS
    this.overlay.showSummary(this.day, st, this.economy.money, this.economy.reputation, isLast, () =>
      this.afterSummary(),
    )
  }

  private afterSummary(): void {
    if (this.economy.money < 0) {
      this.gameOver('Tiền âm sau tổng kết. Chủ nợ gấu trúc đã đến lấy quán.')
      return
    }
    if (this.economy.reputation <= 0) {
      this.gameOver('Uy tín về 0. Không ai dám bước vào quán nữa.')
      return
    }
    if (this.day >= TOTAL_DAYS) {
      this.win()
      return
    }
    this.day += 1
    this.startDay()
  }

  private gameOver(reason: string): void {
    if (this.state === 'gameover') return
    this.state = 'gameover'
    this.clearCustomers()
    this.hud.setVisible(false)
    this.dialog.hide()
    this.request.close()
    this.journal.close()
    this.input.releaseLock()
    this.overlay.showGameOver(reason, this.day, () => this.newGame())
  }

  private win(): void {
    this.state = 'win'
    const score = Math.round(this.economy.money + this.economy.reputation * 5 + this.totalCaught * 30)
    this.overlay.showWin(
      score,
      this.economy.money,
      this.economy.reputation,
      this.totalCaught,
      endingText(this.storyFlags.ending),
      () => this.newGame(),
    )
  }

  // ---------- Vòng lặp ----------

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t))
    const rawDt = (now - this.lastTime) / 1000
    const dt = Math.min(0.05, rawDt)
    this.lastTime = now
    this.adaptResolution(rawDt)

    tweens.update(dt)
    const playing = (this.state === 'open' || this.state === 'closing') && !this.overlay.visible
    this.player.update(dt, this.input, playing && !this.journal.visible)

    if (this.state === 'open' && !this.overlay.visible) this.updateOpen(dt)
    else if (this.state === 'closing') this.updateClosing(dt)

    this.current?.update(dt)
    for (const c of this.others) c.update(dt)
    this.agent?.update(dt)
    this.dialog.update(dt)
    this.effects.update(dt)
    this.bar.update(dt)
    for (const id of this.inventory.update(dt)) this.onDelivered(id)

    this.postfx.render(dt)
    this.input.endFrame()
  }

  private updateOpen(dt: number): void {
    this.frameDt = dt
    // Đồng hồ dừng khi đặc vụ đang nói
    if (!this.cutscene) this.clock.update(dt)
    this.lighting.update(this.clock.progress)
    this.bar.setClock(this.clock.minutes)
    this.hud.setTime(this.clock.label)

    if (!this.current && !this.lineup && !this.cutscene) {
      if (this.queue.length > 0 && !this.clock.isOver) {
        this.spawnTimer -= dt
        if (this.spawnTimer <= 0) this.spawnNext()
      } else if (this.queue.length === 0 || this.clock.isOver) {
        if (this.queue.length > 0) {
          toast(`Hết giờ. ${this.queue.length} khách chưa kịp phục vụ.`, 'info')
          this.queue = []
        }
        this.beginClosing()
        return
      }
    }

    const c = this.current
    if (c && !this.cutscene && Number.isFinite(c.patience) && (c.state === 'waiting' || c.state === 'turning')) {
      c.patience -= dt
      this.dialog.setPatience(c.patience / PATIENCE_SECONDS)
      if (c.patience <= 0) this.walkOut(c)
    }

    this.updateFocus()
    this.handleInput()
    this.updateHint()
  }

  // ---------- Tồn kho: đặt hàng, vác thùng, châm bình ----------

  /** Đồng bộ mức nước các bình và bảng menu với tồn kho */
  private syncStock(): void {
    for (const id of DRINK_IDS) this.bar.setLevel(id, this.inventory.level(id))
    this.bar.setSoldOut(this.inventory.soldOut)
  }

  private onDelivered(id: DrinkId): void {
    this.bar.spawnCrate(id)
    sfx.knock()
    toast(`Hàng tới: thùng ${DRINKS[id].name} đặt dưới sàn, bên phải cạnh cửa kho`, 'info', 3.5)
    this.economy.note(`Nhận thùng ${DRINKS[id].name}.`)
  }

  private openOrderMenu(): void {
    this.request.open(
      DRINK_IDS.map((id, i) => ({
        key: String(i + 1),
        label: `${DRINKS[id].name} · $${cratePrice(id)} · còn ${this.inventory.stock[id]}`,
        disabled: this.economy.money < cratePrice(id),
      })),
      `Đặt hàng · thùng ${CRATE_SERVINGS} ly · tới sau ${Math.round(this.inventory.deliverySeconds)} giây`,
    )
    this.orderOpen = true
    this.hud.setHint('<b>1</b>–<b>8</b> đặt thùng · <b>R</b> đóng')
  }

  private closeOrderMenu(): void {
    this.orderOpen = false
    this.request.close()
  }

  orderDrink(id: DrinkId): void {
    const price = cratePrice(id)
    if (!this.economy.spend(price)) {
      toast('Không đủ tiền đặt hàng.', 'bad', 1.6)
      sfx.bad()
      return
    }
    this.inventory.order(id)
    sfx.bell()
    toast(`Đã đặt thùng ${DRINKS[id].name} (−$${price}), tới sau ${Math.round(this.inventory.deliverySeconds)} giây`, 'good', 3)
    this.economy.note(`Đặt thùng ${DRINKS[id].name}: −$${price}.`)
    this.closeOrderMenu()
  }

  private setCarry(id: DrinkId | null): void {
    this.carry = id
    this.fill = 0
    this.player.setCarry(id ? DRINKS[id].color : null)
  }

  private pickCrate(id: DrinkId): void {
    const crate = this.bar.crates.find((c) => c.id === id)
    if (!crate) return
    this.bar.removeCrate(crate)
    this.setCarry(id)
    sfx.thud()
  }

  /** Giữ E trước đúng bình để châm; xong thì tồn kho tăng và thùng biến mất */
  private updateFilling(): void {
    const f = this.focus
    const id = this.carry
    if (!id || !f || f.kind !== 'dispenser' || f.id !== id || !this.input.isDown('KeyE')) return
    this.fill = Math.min(1, this.fill + this.frameDt / FILL_SECONDS)
    const stock = this.inventory.stock[id]
    this.bar.setLevel(id, Math.min(1, (stock + CRATE_SERVINGS * this.fill) / MAX_STOCK))
    this.pourTimer -= this.frameDt
    if (this.pourTimer <= 0) {
      sfx.pour()
      this.pourTimer = 0.5
    }
    if (this.fill >= 1) {
      this.inventory.add(id, CRATE_SERVINGS)
      this.setCarry(null)
      this.syncStock()
      sfx.clink()
      toast(`Đã châm ${DRINKS[id].name}: ${this.inventory.stock[id]}/${MAX_STOCK}`, 'good', 2.2)
      this.economy.note(`Châm ${DRINKS[id].name}.`)
    }
  }

  /** Raycast từ tâm màn hình vào bình và thùng trong tầm với */
  private updateFocus(): void {
    const rc = this.player.centerRay()
    rc.far = 3.2
    const hits = rc.intersectObjects(this.bar.interactables(), true)
    let found: Focus | null = null
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object
      while (o && !found) {
        if (o.userData.crate) found = { kind: 'crate', id: o.userData.crate as DrinkId }
        else if (o.userData.drink) found = { kind: 'dispenser', id: o.userData.drink as DrinkId }
        o = o.parent
      }
      if (found) break
    }
    this.focus = found
  }

  /** Dùng khi kiểm thử headless: quay camera nhìn vào một điểm */
  debugLookAt(x: number, y: number, z: number): void {
    const p = this.player.camera.position
    const dx = x - p.x
    const dy = y - p.y
    const dz = z - p.z
    this.player.yaw = Math.atan2(-dx, -dz)
    this.player.pitch = Math.atan2(dy, Math.hypot(dx, dz))
  }

  private updateClosing(dt: number): void {
    this.closingTimer += dt
    if ((this.others.length === 0 && this.closingTimer > 1.0) || this.closingTimer > 14) {
      for (const c of this.others) c.remove()
      this.others.length = 0
      this.endDay()
    }
  }

  // ---------- Khách ----------

  private claim(c: Customer): string {
    return c.spec.displayName ?? c.spec.species.name
  }

  private useDoor(open: boolean): void {
    this.doorUsers = Math.max(0, this.doorUsers + (open ? 1 : -1))
    if (open && this.doorUsers === 1) {
      this.bar.openDoor()
      sfx.bell()
      sfx.creak()
    }
    if (!open && this.doorUsers === 0) {
      this.bar.closeDoor()
      sfx.creak(true)
    }
  }

  private spawnNext(): void {
    const spec = this.queue.shift()
    if (!spec) return
    const c = new Customer(spec, this.scene, this.spawnIn)
    c.lookTarget = this.player.camera.position
    this.current = c
    this.useDoor(true)
    c.walkTo(this.doorIn, () => {
      this.useDoor(false)
      c.walkTo(this.bar.counterSpot, () => {
        if (this.current !== c) return
        c.state = 'waiting'
        c.face(0)
        c.greet()
        if (spec.story) {
          // Khách cốt truyện: nói phần của mình trước, chưa tính kiên nhẫn
          c.patience = Infinity
          this.economy.note(`${this.claim(c)} bước vào quán.`)
          this.startLines(c, this.claim(c), storyLines(spec.story), () => this.afterStoryLines(c))
          return
        }
        c.talk(1.6)
        const out = this.inventory.has(spec.order) ? '' : ' Hết rồi à? Tôi đợi được một lát.'
        this.dialog.say(this.claim(c), `${spec.greeting} Cho tôi một ${DRINKS[spec.order].name}.${out}`)
        this.dialog.setPatience(1)
        this.setHint()
      })
    })
    this.hud.setRemaining(this.queue.length + 1)
    this.setHint()
  }

  private leave(c: Customer, hideDialogAfter = 1.8): void {
    c.state = 'leaving'
    if (this.current === c) {
      this.current = null
      this.dialog.setPatience(null)
      tweens.delay(hideDialogAfter, () => {
        if (!this.current || this.current.state !== 'waiting') this.dialog.hide()
      })
    }
    this.others.push(c)
    this.spawnTimer = 1.6
    c.walkTo(this.doorOut, () => {
      this.useDoor(true)
      c.walkTo(this.spawnOut, () => {
        this.useDoor(false)
        this.removeOther(c)
      })
    })
    this.setHint()
  }

  private removeOther(c: Customer): void {
    const i = this.others.indexOf(c)
    if (i >= 0) this.others.splice(i, 1)
    c.remove()
  }

  private walkOut(c: Customer): void {
    this.economy.addRep(REP_WALKOUT)
    this.economy.stats.walkedOut += 1
    sfx.bad()
    this.economy.note(`${this.claim(c)} chờ quá lâu và bỏ về.`)
    toast(`Khách chờ lâu quá và bỏ về. Uy tín ${REP_WALKOUT}`, 'bad')
    this.dialog.say(this.claim(c), 'Lâu quá. Tôi đi đây.')
    c.talk(1)
    this.leave(c)
  }

  private serve(): void {
    const c = this.current
    if (!c || c.state !== 'waiting') return
    if (c.spec.story === 'tailor') {
      this.resolveTailorServed(c)
      return
    }
    const drink = DRINKS[c.spec.order]
    if (!this.inventory.take(drink.id)) {
      toast(`Hết ${drink.name}! Nhấn R đặt hàng, thùng tới thì vác ra châm vào bình.`, 'bad', 3)
      sfx.bad()
      return
    }
    this.syncStock()
    const price = Math.round(drink.price * this.economy.priceMod)
    this.economy.earn(price)
    this.economy.stats.served += 1
    if (c.spec.story === 'mayor') {
      this.economy.bounty(200)
      this.economy.addRep(10)
      this.storyFlags.mayorServed = true
      toast('Thị trưởng hài lòng: +$200, uy tín +10', 'good', 3.5)
      this.economy.note('Phục vụ thị trưởng Gấu: +$200, uy tín +10.')
    }
    if (c.spec.isHuman) {
      this.economy.stats.slipped += 1
      this.economy.note(`${this.claim(c)} gọi ${drink.name}: đã phục vụ.`)
    } else {
      this.economy.addRep(REP_SERVED)
      this.economy.note(`${this.claim(c)} gọi ${drink.name}: đã phục vụ, khách hài lòng.`)
    }
    toast(`+$${price} · ${drink.name}`, 'good', 2)
    sfx.clink()
    tweens.delay(0.35, () => sfx.coin())
    this.dialog.say(this.claim(c), pick(THANKS))
    this.dialog.setPatience(null)
    c.setMood('neutral')
    c.talk(1)
    // Khách nâng ly uống xong mới rời quán
    c.drink(drink.color, () => this.leave(c))
    this.setHint()
  }

  private openRequest(): void {
    const c = this.current
    if (!c || c.state !== 'waiting') {
      toast('Chưa có khách sẵn sàng ở quầy.', 'info', 1.5)
      return
    }
    const s = c.spec.species
    this.request.open([
      { key: '1', label: 'Quay người lại', disabled: c.asked.turn },
      { key: '2', label: 'Đọc khẩu hiệu của loài', disabled: c.asked.slogan },
      { key: '3', label: `Hỏi: “${s.question}”`, disabled: c.asked.question },
      { key: 'Q', label: 'Đóng' },
    ])
  }

  private doRequest(kind: 'turn' | 'slogan' | 'question'): void {
    const c = this.current
    this.request.close()
    if (!c || c.state !== 'waiting') return
    const who = this.claim(c)
    const later = (seconds: number, line: string) =>
      tweens.delay(seconds, () => {
        if (this.current !== c || c.state === 'gone' || c.state === 'down') return
        this.dialog.say(who, line)
        c.talk(1.5)
      })

    if (kind === 'turn') {
      if (c.asked.turn) return
      this.dialog.say(who, 'Được thôi...')
      c.talk(0.8)
      c.turnAround(() => {
        if (this.current === c) {
          this.dialog.say(who, 'Xong chưa? Tôi khát rồi.')
          c.talk(1)
        }
      })
    } else if (kind === 'slogan') {
      if (c.asked.slogan) return
      c.asked.slogan = true
      this.dialog.say(who, 'Khẩu hiệu à? Để xem...')
      c.talk(0.8)
      later(0.9, `“${c.spec.sloganText}!”`)
    } else {
      if (c.asked.question) return
      c.asked.question = true
      this.dialog.say(who, 'Hỏi gì kỳ vậy...')
      c.talk(0.8)
      later(0.9, `${c.spec.answerText}.`)
    }
  }

  // ---------- Bắn ----------

  private shoot(): void {
    if (!this.economy.useAmmo()) {
      toast('Hết đạn!', 'bad', 1.5)
      return
    }
    const rc = this.player.fire()
    this.effects.flash(this.player.muzzleWorld)
    this.effects.casing(this.player.muzzleWorld, this.player.rightDir)
    sfx.gunshot()
    screenFlash('white')

    const targets = [this.current, ...this.others].filter(
      (c): c is Customer => !!c && c.state !== 'down' && c.state !== 'gone',
    )
    let hit: Customer | null = null
    let best = Infinity
    for (const c of targets) {
      const hits = rc.intersectObject(c.root, true)
      if (hits.length && hits[0].distance < best) {
        best = hits[0].distance
        hit = c
      }
    }
    if (!hit) {
      // Trượt: để lại vết đạn trên tường / đồ đạc
      const env = rc.intersectObject(this.bar.group, true)[0]
      if (env && env.face) {
        const normal = env.face.normal.clone().transformDirection(env.object.matrixWorld)
        this.effects.bulletHole(env.point, normal)
      }
      toast('Trượt.', 'info', 1.2)
      return
    }
    this.resolveShot(hit)
  }

  private resolveShot(c: Customer): void {
    const who = this.claim(c)
    const wasLeaving = c.state === 'leaving'
    const role = c.spec.story
    if (this.current === c) {
      this.current = null
      this.dialog.setPatience(null)
      this.others.push(c)
    }
    this.spawnTimer = 5

    if (role === 'informant') this.storyFlags.informantShot = true
    if (role === 'mayor') tweens.delay(1.8, () => this.gameOver(mayorShotReason()))
    if (role === 'tailor') {
      // Nộp Thợ May: thưởng đặc biệt, đặc vụ nói lời cuối sau khi ông ấy ngã
      this.economy.bounty(300 - BOUNTY)
      toast('Thưởng đặc biệt: +$300 và một tấm huy chương', 'good', 4)
      this.economy.note('Thợ May: đã bắn. +$300, huy chương Thanh Lọc.')
      tweens.delay(2.6, () => this.agentEpilogue('bureau'))
    }

    if (c.spec.isHuman) {
      this.economy.bounty(BOUNTY)
      this.economy.addRep(REP_CATCH)
      this.economy.stats.caught += 1
      this.totalCaught += 1
      if (wasLeaving) this.economy.stats.slipped = Math.max(0, this.economy.stats.slipped - 1)
      this.effects.burst(c.chest, c.rig.furColor, 'chunk', 14)
      tweens.delay(0.6, () => sfx.coin())
      toast(`Đúng là người! +$${BOUNTY}, uy tín +${REP_CATCH}`, 'good')
      this.dialog.say(who, 'Khốn... kiếp...')
      const clueNames = [...c.spec.clues].map((id) => CLUE_BY_ID[id].name).join(', ')
      this.economy.note(`Bắt đúng người giả ${who}. Sơ hở: ${clueNames}.`)
      c.knockDown(true, () => this.afterBody(c))
    } else {
      this.economy.fine(MISFIRE_FINE)
      this.economy.addRep(REP_MISFIRE)
      this.economy.stats.misfires += 1
      this.effects.burst(c.chest, c.rig.furColor, 'fur', 50)
      tweens.delay(0.4, () => sfx.bad())
      screenFlash('red')
      toast(`Bắn nhầm thú thật! −$${MISFIRE_FINE}, uy tín ${REP_MISFIRE}`, 'bad', 4)
      this.dialog.say(who, 'Tại... sao...?')
      const quirk = c.spec.quirk ? ` Điểm lạ chỉ là ${QUIRK_LABEL[c.spec.quirk]}.` : ''
      this.economy.note(`Bắn nhầm ${who} thật.${quirk}`)
      c.knockDown(false, () => this.afterBody(c))
      const fled = Math.min(2, this.queue.length)
      if (fled > 0) {
        this.queue.splice(0, fled)
        toast(`${fled} khách hoảng sợ bỏ về.`, 'bad')
      }
      if (this.economy.reputation <= 0) {
        tweens.delay(1.6, () => this.gameOver('Uy tín về 0. Không ai dám bước vào quán nữa.'))
      }
    }
    this.hud.setRemaining(this.queue.length)
    this.setHint()
  }

  private afterBody(c: Customer): void {
    const i = this.others.indexOf(c)
    if (i >= 0) this.others.splice(i, 1)
    if (!this.current) this.dialog.hide()
    this.spawnTimer = Math.min(this.spawnTimer, 0.8)
  }

  // ---------- Input ----------

  private handleInput(): void {
    const inp = this.input

    if (inp.wasPressed('Tab')) {
      if (this.journal.visible) this.journal.close()
      else {
        this.request.close()
        this.journal.open(this.day, this.economy.log)
      }
    }
    if (this.journal.visible) return

    if (inp.wasPressed('KeyM')) {
      sfx.unlock()
      toast(sfx.toggleMute() ? 'Âm thanh: tắt' : 'Âm thanh: bật', 'info', 1.4)
    }

    if (this.cutscene) {
      // Đang có lựa chọn: 1 / 2 trả lời
      if (this.choice) {
        if (inp.wasPressed('Digit1')) this.pickChoice(0)
        else if (inp.wasPressed('Digit2')) this.pickChoice(1)
        this.hud.setZoom(this.player.isZooming)
        return
      }
      // Trong cảnh cốt truyện: E / chuột trái / Space để tiếp lời, không bắn, không gọi menu yêu cầu
      if (inp.wasPressed('KeyE') || inp.wasPressed('Space') || inp.mousePressed[0]) {
        if (this.speaker?.state === 'waiting') this.advanceLine()
      }
      if (inp.wasPressed('Digit1')) this.setTool('hands')
      if (inp.wasPressed('Digit2')) this.setTool('gun')
      this.hud.setZoom(this.player.isZooming)
      return
    }

    // Menu đặt hàng: 1–8 chọn món, R / Q đóng
    if (this.orderOpen) {
      for (let i = 0; i < DRINK_IDS.length; i++) {
        if (inp.wasPressed(`Digit${i + 1}`)) this.orderDrink(DRINK_IDS[i])
      }
      if (inp.wasPressed('KeyR') || inp.wasPressed('KeyQ') || inp.wasPressed('Escape')) this.closeOrderMenu()
      return
    }

    if (this.request.visible) {
      if (inp.wasPressed('Digit1')) this.doRequest('turn')
      else if (inp.wasPressed('Digit2')) this.doRequest('slogan')
      else if (inp.wasPressed('Digit3')) this.doRequest('question')
      else if (inp.wasPressed('KeyQ')) this.request.close()
      return
    }

    if (inp.wasPressed('KeyR')) {
      this.openOrderMenu()
      return
    }
    if (inp.wasPressed('Digit1')) this.setTool('hands')
    if (inp.wasPressed('Digit2')) {
      if (this.carry) toast('Đang vác thùng, bỏ thùng vào bình trước đã.', 'info', 1.6)
      else this.setTool('gun')
    }
    if (inp.wasPressed('KeyQ')) this.openRequest()

    // E: nhặt thùng đang nhìn, châm bình (giữ), hoặc phục vụ khách
    const f = this.focus
    if (inp.wasPressed('KeyE')) {
      if (f?.kind === 'crate' && !this.carry) this.pickCrate(f.id)
      else if (f?.kind === 'crate' && this.carry) toast('Đang vác một thùng rồi.', 'info', 1.4)
      else if (f?.kind === 'dispenser' && this.carry && this.carry !== f.id) {
        toast(`Sai bình: thùng đang vác là ${DRINKS[this.carry].name}.`, 'bad', 1.8)
      } else if (!(f?.kind === 'dispenser' && this.carry === f.id)) this.serve()
    }
    this.updateFilling()

    // Chuột trái, hoặc Space cho trackpad Mac
    if ((inp.mousePressed[0] || inp.wasPressed('Space')) && this.player.tool === 'gun') this.shoot()
    this.hud.setZoom(this.player.isZooming)
    this.updateMood()
  }

  /** Khách ở quầy phản ứng: sợ khi thấy súng, nghi ngờ khi bị soi tận mặt. */
  private updateMood(): void {
    const c = this.current
    if (!c || (c.state !== 'waiting' && c.state !== 'turning')) return
    let mood: Mood = 'neutral'
    if (this.player.tool === 'gun') mood = 'scared'
    else if (this.player.isZooming && this.player.centerRay().intersectObject(c.root, true).length > 0) mood = 'suspicious'
    c.setMood(mood)
  }

  private setTool(tool: Tool): void {
    const wasGun = this.player.tool === 'gun'
    this.player.setTool(tool)
    this.hud.setTool(tool)
    const c = this.current
    if (tool === 'gun' && !wasGun && c && c.state === 'waiting' && !c.reactedToGun) {
      c.reactedToGun = true
      this.dialog.say(this.claim(c), pick(GUN_LINES))
      c.talk(1.2)
    }
  }

  private setHint(): void {
    if (this.cutscene || this.lineup) return
    this.hud.setHint(this.baseHint())
  }

  /** Gợi ý theo trạng thái khách, kèm đơn hàng đang tới */
  private baseHint(): string {
    const c = this.current
    let text: string
    if (c && (c.state === 'waiting' || c.state === 'turning')) {
      text = '<b>E</b> phục vụ · <b>Q</b> yêu cầu · <b>Chuột phải</b> soi · <b>2</b> súng · <b>R</b> đặt hàng · <b>Tab</b> sổ tay'
    } else if (c && c.state === 'drinking') {
      text = 'Khách đang uống... · <b>Tab</b> sổ tay'
    } else if (c) {
      text = 'Khách đang vào... · <b>Tab</b> sổ tay'
    } else {
      text = 'Đang chờ khách · <b>R</b> đặt hàng · <b>Tab</b> sổ tay'
    }
    const next = this.inventory.nextArrival
    if (next) text += ` · hàng ${DRINKS[next.id].name} tới sau ${Math.ceil(next.left)}s`
    return text
  }

  /** Mỗi khung: gợi ý theo vật đang nhìn và thùng đang vác, nếu không thì gợi ý nền */
  private updateHint(): void {
    if (this.cutscene || this.lineup || this.orderOpen || this.request.visible || this.journal.visible) return
    const f = this.focus
    const carryName = this.carry ? DRINKS[this.carry].name : ''
    if (f?.kind === 'crate') {
      this.hud.setHint(
        this.carry ? `Đang vác thùng ${carryName}` : `<b>E</b> nhặt thùng ${DRINKS[f.id].name} (${CRATE_SERVINGS} ly)`,
      )
      return
    }
    if (f?.kind === 'dispenser') {
      const stock = this.inventory.stock[f.id]
      let tail = ''
      if (this.carry === f.id) tail = this.fill > 0 ? ` · đang châm ${Math.round(this.fill * 100)}%` : ' · giữ <b>E</b> để châm'
      else if (this.carry) tail = ` · thùng đang vác là ${carryName}`
      else if (stock <= 0) tail = ' · hết, <b>R</b> đặt hàng'
      this.hud.setHint(`${DRINKS[f.id].name}: ${stock}/${MAX_STOCK}${tail}`)
      return
    }
    if (this.carry) {
      this.hud.setHint(`Đang vác thùng ${carryName} · quay lại nhìn bình ${carryName} rồi giữ <b>E</b>`)
      return
    }
    this.hud.setHint(this.baseHint())
  }

  private refreshHud(): void {
    this.hud.setMoney(this.economy.money)
    this.hud.setRep(this.economy.reputation)
    this.hud.setAmmo(this.economy.ammo)
    this.hud.setTool(this.player.tool)
  }

  private clearCustomers(): void {
    this.current?.remove()
    this.current = null
    for (const c of this.others) c.remove()
    this.others.length = 0
    this.agent?.remove()
    this.agent = null
    this.cutscene = false
    this.speaker = null
    this.choice = null
    this.onLinesDone = null
    this.request.close()
    this.dialog.setPrompt(false)
    this.queue = []
    this.doorUsers = 0
    this.bar.closeDoor()
    tweens.clear()
  }

  private onLockChange(locked: boolean): void {
    if (locked || this.debug) return
    if (this.state === 'open' && !this.overlay.visible) {
      this.request.close()
      this.overlay.showPause(() => {
        this.overlay.hide()
        this.input.requestLock()
      })
    }
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.postfx.setSize(window.innerWidth, window.innerHeight)
    this.player.resize(window.innerWidth / window.innerHeight)
  }

  /** Đo khung hình mỗi 2 giây; dưới 40 fps thì hạ pixel ratio từng nấc 0.25 tới tối thiểu 1. */
  private adaptResolution(rawDt: number): void {
    if (this.hd || rawDt > 0.25) return
    this.fpsTimer += rawDt
    this.fpsFrames += 1
    if (this.fpsTimer < 2) return
    const fps = this.fpsFrames / this.fpsTimer
    this.fpsTimer = 0
    this.fpsFrames = 0
    const pr = this.renderer.getPixelRatio()
    if (fps < 40 && pr > 1) {
      this.renderer.setPixelRatio(Math.max(1, pr - 0.25))
      this.onResize()
    }
  }
}
