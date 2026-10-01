import { $, show, esc } from './dom'

export interface RequestItem {
  key: string
  label: string
  disabled?: boolean
}

export class RequestMenu {
  private readonly root = $('request')
  private readonly list = $('request-list')
  visible = false

  open(items: RequestItem[]): void {
    this.list.innerHTML = items
      .map(
        (it) =>
          `<li class="${it.disabled ? 'disabled' : ''}"><span class="key">${esc(it.key)}</span>${esc(it.label)}</li>`,
      )
      .join('')
    show(this.root, true)
    this.visible = true
  }

  close(): void {
    show(this.root, false)
    this.visible = false
  }
}
