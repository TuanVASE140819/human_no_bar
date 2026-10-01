export class Input {
  readonly keys = new Set<string>()
  readonly pressed = new Set<string>()
  mouseDX = 0
  mouseDY = 0
  readonly mouseDown: boolean[] = [false, false, false]
  readonly mousePressed: boolean[] = [false, false, false]
  locked = false
  onLockChange?: (locked: boolean) => void
  /** Ctrl + click trên macOS đang được coi là chuột phải */
  private ctrlRight = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault()
      if (e.repeat) return
      this.keys.add(e.code)
      this.pressed.add(e.code)
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
    })
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouseDown.fill(false)
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('mousedown', (e) => {
      if (e.button > 2) return
      // macOS: Ctrl + click (trackpad không có nút phải) coi như chuột phải
      let b = e.button
      if (b === 0 && e.ctrlKey) {
        b = 2
        this.ctrlRight = true
      }
      this.mouseDown[b] = true
      if (this.locked) this.mousePressed[b] = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button > 2) return
      if (e.button === 0 && this.ctrlRight) {
        // Nhả Ctrl trước khi nhả chuột vẫn phải tắt "chuột phải"
        this.ctrlRight = false
        this.mouseDown[2] = false
        this.mouseDown[0] = false
        return
      }
      this.mouseDown[e.button] = false
    })
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return
      this.mouseDX += e.movementX
      this.mouseDY += e.movementY
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
      if (!this.locked) {
        this.mouseDown.fill(false)
        this.keys.clear()
      }
      this.onLockChange?.(this.locked)
    })
  }

  requestLock(): void {
    if (this.locked) return
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined
      p?.catch?.(() => {})
    } catch {
      /* pointer lock không khả dụng (ví dụ headless) */
    }
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock()
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code)
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  endFrame(): void {
    this.pressed.clear()
    this.mousePressed.fill(false)
    this.mouseDX = 0
    this.mouseDY = 0
  }
}
