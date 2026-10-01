export function $(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Thiếu phần tử #${id} trong index.html`)
  return el
}

export function show(el: HTMLElement, visible: boolean): void {
  el.classList.toggle('hidden', !visible)
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
