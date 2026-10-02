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
import { AGENT_NAME, agentSpec, introLines, dailyLines } from '@/data/story'
import { DayClock } from '@/systems/DayClock'
import { dayConfig, TOTAL_DAYS } from '@/data/difficulty'
import { DRINKS } from '@/data/drinks'
import { CLUE_BY_ID, type Quirk } from '@/data/clues'
import { Hud } from '@/ui/Hud'
import { Dialog } from '@/ui/Dialog'
import { RequestMenu } from '@/ui/RequestMenu'
import { Journal } from '@/ui/Journal'
import { Overlay } from '@/ui/Overlay'
import { toast, screenFlash } from '@/ui/Toast'

type GameState = 'menu' | 'morning' | 'open' | 'closing' | 'summary' | 'gameover' | 'win'

const THANKS = ['Cảm ơn ông chủ!', 'Tuyệt. Hẹn gặp lại.', 'Đúng vị. Cảm ơn.', 'Hôm nay ông chủ tử tế ghê.']
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
  private readonly clock = new DayClock()
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

  /** Cảnh cốt truyện: đặc vụ ghé quán mỗi sáng, đồng hồ dừng, chưa sinh khách */
  private agent: Customer | null = null
  private cutscene = false
  private lines: string[] = []
  private lineIndex = 0
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
    this.postfx = new PostFX(this.renderer, this.scene, this.player.camera)
    // ?nofx tắt viền toon và hậu kỳ cho máy yếu
    this.postfx.enabled = !params.has('nofx')

    this.economy.onChange = () => this.refreshHud()
    this.input.onLockChange = (locked) => this.onLockChange(locked)
    window.addEventListener('resize', () => this.onResize())

    this.showMenu()
    requestAnimationFrame((t) => this.frame(t))
  }

  /** Dùng khi chạy kiểm thử headless: bỏ qua menu, mở quán ngay. intro = vẫn chạy cảnh đặc vụ. */
  debugStart(intro = false): void {
    this.debug = true
    this.forceIntro = intro
    this.newGame()
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
    this.clearCustomers()
    this.economy.money = 200
    this.economy.reputation = 50
    this.economy.ammo = 6
    this.totalCaught = 0
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

  private startVisit(): void {
    this.cutscene = true
    this.lines = this.day === 1 ? introLines() : dailyLines(this.day, this.yesterday)
    this.lineIndex = 0
    const a = new Customer(agentSpec(), this.scene, this.spawnIn)
    a.lookTarget = this.player.camera.position
    this.agent = a
    this.useDoor(true)
    a.walkTo(this.doorIn, () => {
      this.useDoor(false)
      a.walkTo(this.bar.counterSpot, () => {
        if (this.agent !== a) return
        a.state = 'waiting'
        a.face(0)
        this.showLine(0)
      })
    })
    this.hud.setHint('Đặc vụ đang vào...')
  }

  private showLine(i: number): void {
    const a = this.agent
    if (!a) return
    this.lineIndex = i
    const line = this.lines[i]
    this.dialog.say(AGENT_NAME, line, true)
    this.dialog.setPrompt(true)
    this.dialog.setPatience(null)
    a.talk(Math.min(4, 0.6 + line.length / 42))
    this.hud.setHint('<b>E</b> hoặc <b>chuột trái</b> để tiếp · <b>Tab</b> sổ tay')
  }

  private advanceLine(): void {
    if (this.dialog.isTyping) {
      this.dialog.finish()
      return
    }
    if (this.lineIndex + 1 < this.lines.length) this.showLine(this.lineIndex + 1)
    else this.endVisit()
  }

  private endVisit(): void {
    const a = this.agent
    this.cutscene = false
    this.dialog.setPrompt(false)
    tweens.delay(1.2, () => {
      if (!this.current) this.dialog.hide()
    })
    if (a) {
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
    this.spawnTimer = 2.0
    if (this.day === 1) toast('Nhiệm vụ: trụ 7 ngày. Không để người lọt.', 'info', 4)
    this.setHint()
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
    this.overlay.showWin(score, this.economy.money, this.economy.reputation, this.totalCaught, () => this.newGame())
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

    this.postfx.render(dt)
    this.input.endFrame()
  }

  private updateOpen(dt: number): void {
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
    if (c && (c.state === 'waiting' || c.state === 'turning')) {
      c.patience -= dt
      this.dialog.setPatience(c.patience / PATIENCE_SECONDS)
      if (c.patience <= 0) this.walkOut(c)
    }

    this.handleInput()
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
    return c.spec.species.name
  }

  private useDoor(open: boolean): void {
    this.doorUsers = Math.max(0, this.doorUsers + (open ? 1 : -1))
    if (open && this.doorUsers === 1) this.bar.openDoor()
    if (!open && this.doorUsers === 0) this.bar.closeDoor()
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
        c.talk(1.6)
        this.dialog.say(this.claim(c), `${spec.greeting} Cho tôi một ${DRINKS[spec.order].name}.`)
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
    this.economy.note(`${this.claim(c)} chờ quá lâu và bỏ về.`)
    toast(`Khách chờ lâu quá và bỏ về. Uy tín ${REP_WALKOUT}`, 'bad')
    this.dialog.say(this.claim(c), 'Lâu quá. Tôi đi đây.')
    c.talk(1)
    this.leave(c)
  }

  private serve(): void {
    const c = this.current
    if (!c || c.state !== 'waiting') return
    const drink = DRINKS[c.spec.order]
    const price = Math.round(drink.price * this.economy.priceMod)
    this.economy.earn(price)
    this.economy.stats.served += 1
    if (c.spec.isHuman) {
      this.economy.stats.slipped += 1
      this.economy.note(`${this.claim(c)} gọi ${drink.name}: đã phục vụ.`)
    } else {
      this.economy.addRep(REP_SERVED)
      this.economy.note(`${this.claim(c)} gọi ${drink.name}: đã phục vụ, khách hài lòng.`)
    }
    toast(`+$${price} · ${drink.name}`, 'good', 2)
    this.dialog.say(this.claim(c), pick(THANKS))
    this.dialog.setPatience(null)
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
      toast('Trượt.', 'info', 1.2)
      return
    }
    this.resolveShot(hit)
  }

  private resolveShot(c: Customer): void {
    const who = this.claim(c)
    const wasLeaving = c.state === 'leaving'
    if (this.current === c) {
      this.current = null
      this.dialog.setPatience(null)
      this.others.push(c)
    }
    this.spawnTimer = 5

    if (c.spec.isHuman) {
      this.economy.bounty(BOUNTY)
      this.economy.addRep(REP_CATCH)
      this.economy.stats.caught += 1
      this.totalCaught += 1
      if (wasLeaving) this.economy.stats.slipped = Math.max(0, this.economy.stats.slipped - 1)
      this.effects.burst(c.chest, c.rig.furColor, 'chunk', 14)
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

    if (this.cutscene) {
      // Trong cảnh đặc vụ: E / chuột trái / Space để tiếp lời, không bắn, không gọi menu yêu cầu
      if (inp.wasPressed('KeyE') || inp.wasPressed('Space') || inp.mousePressed[0]) {
        if (this.agent?.state === 'waiting') this.advanceLine()
      }
      if (inp.wasPressed('Digit1')) this.setTool('hands')
      if (inp.wasPressed('Digit2')) this.setTool('gun')
      this.hud.setZoom(this.player.isZooming)
      return
    }

    if (this.request.visible) {
      if (inp.wasPressed('Digit1')) this.doRequest('turn')
      else if (inp.wasPressed('Digit2')) this.doRequest('slogan')
      else if (inp.wasPressed('Digit3')) this.doRequest('question')
      else if (inp.wasPressed('KeyQ')) this.request.close()
      return
    }

    if (inp.wasPressed('Digit1')) this.setTool('hands')
    if (inp.wasPressed('Digit2')) this.setTool('gun')
    if (inp.wasPressed('KeyQ')) this.openRequest()
    if (inp.wasPressed('KeyE')) this.serve()
    // Chuột trái, hoặc Space cho trackpad Mac
    if ((inp.mousePressed[0] || inp.wasPressed('Space')) && this.player.tool === 'gun') this.shoot()
    this.hud.setZoom(this.player.isZooming)
  }

  private setTool(tool: Tool): void {
    this.player.setTool(tool)
    this.hud.setTool(tool)
  }

  private setHint(): void {
    if (this.cutscene) return
    const c = this.current
    if (c && (c.state === 'waiting' || c.state === 'turning')) {
      this.hud.setHint(
        '<b>E</b> phục vụ · <b>Q</b> yêu cầu · <b>Chuột phải</b> soi · <b>2</b> súng · <b>Tab</b> sổ tay',
      )
    } else if (c && c.state === 'drinking') {
      this.hud.setHint('Khách đang uống... · <b>Tab</b> sổ tay')
    } else if (c) {
      this.hud.setHint('Khách đang vào... · <b>Tab</b> sổ tay')
    } else if (!this.lineup) {
      this.hud.setHint('Đang chờ khách · <b>Tab</b> sổ tay')
    }
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
