import { $ } from './dom'

export type ToastKind = 'good' | 'bad' | 'info'

export function toast(text: string, kind: ToastKind = 'info', seconds = 3.2): void {
  const root = $('toasts')
  const el = document.createElement('div')
  el.className = `toast ${kind}`
  el.textContent = text
  root.appendChild(el)
  requestAnimationFrame(() => el.classList.add('in'))
  window.setTimeout(() => {
    el.classList.remove('in')
    window.setTimeout(() => el.remove(), 400)
  }, seconds * 1000)
}

export function screenFlash(kind: 'red' | 'white'): void {
  const el = $('flash')
  el.className = kind
  void el.offsetWidth
  el.classList.add('on')
  window.setTimeout(() => el.classList.remove('on'), 120)
}
