import type { Arrangement, Card, Rank, Suit } from '../core/types'

const RANK_LABELS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const

const SUIT_LABELS = ['♠', '♣', '♦', '♥'] as const

export function cardKey(c: Card): string {
  return `${c.rank}-${c.suit}`
}

export function cardLabel(c: Card): { rank: string; suit: string; red: boolean } {
  return {
    rank: RANK_LABELS[c.rank as Rank]!,
    suit: SUIT_LABELS[c.suit as Suit]!,
    red: c.suit === 2 || c.suit === 3,
  }
}

export function createFaceCard(
  card: Card,
  opts: { selected?: boolean; compact?: boolean; onClick?: () => void } = {},
): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  const info = cardLabel(card)
  el.className = `card face ${info.red ? 'red' : 'black'}${opts.compact ? ' compact' : ''}${opts.selected ? ' selected' : ''}`
  el.dataset.key = cardKey(card)
  el.innerHTML = `<span class="rank">${info.rank}</span><span class="suit">${info.suit}</span>`
  el.setAttribute('aria-label', `${info.rank}${info.suit}`)
  if (opts.onClick) el.addEventListener('click', opts.onClick)
  return el
}

export function createBackCard(
  compact = false,
  opts: { peekable?: boolean; onClick?: () => void } = {},
): HTMLElement {
  if (opts.onClick || opts.peekable) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = `card back${compact ? ' compact' : ''}${opts.peekable ? ' peekable' : ''}`
    el.setAttribute('aria-label', opts.peekable ? 'Xem (peek)' : 'Úp')
    if (opts.onClick) el.addEventListener('click', opts.onClick)
    return el
  }
  const el = document.createElement('div')
  el.className = `card back${compact ? ' compact' : ''}`
  el.setAttribute('aria-label', 'Úp')
  return el
}

/**
 * Face-down bot card that toggles face-up on click (temporary peek).
 * Click again to hide. Used when LEVELS.peek is true.
 */
export function createPeekToggleCard(
  card: Card,
  compact = false,
): HTMLElement {
  let revealed = false
  const host = document.createElement('span')
  host.className = 'peek-host'

  function paint(): void {
    host.innerHTML = ''
    if (revealed) {
      const face = createFaceCard(card, {
        compact,
        onClick: () => {
          revealed = false
          paint()
        },
      })
      face.classList.add('peek-revealed')
      face.title = 'Ẩn lại'
      host.appendChild(face)
    } else {
      host.appendChild(
        createBackCard(compact, {
          peekable: true,
          onClick: () => {
            revealed = true
            paint()
          },
        }),
      )
    }
  }

  paint()
  return host
}

export type ChiId = 'front' | 'middle' | 'back'

const CHI_CAPACITY: Record<ChiId, number> = {
  front: 3,
  middle: 5,
  back: 5,
}

export type ArrangeController = {
  root: HTMLElement
  /** Reset tray from a fresh 13-card hand; clears chis. */
  setHand: (hand: Card[]) => void
  /** Apply a full arrangement (e.g. Xếp gợi ý); empties tray. */
  applyArrangement: (arr: Arrangement) => void
  /** Current layout; null if not all 13 placed (3+5+5). */
  getArrangement: () => Arrangement | null
  /** Current hand still held (tray + chis). */
  getAllCards: () => Card[]
  setEnabled: (on: boolean) => void
  clear: () => void
}

type Zone = 'tray' | ChiId

/**
 * Human tray + 3 chi slots (Trước 3 / Giữa 5 / Sau 5). Click card to select,
 * click slot (or card in slot) to place / move / return to tray.
 */
export function createArrangeController(parent: HTMLElement): ArrangeController {
  const root = document.createElement('div')
  root.className = 'human-zone'
  root.innerHTML = `
    <div class="chi-slots">
      <div class="chi-slot" data-chi="front">
        <div class="chi-slot-title">Chi Trước (3)</div>
        <div class="chi-slot-cards" data-cards="front"></div>
      </div>
      <div class="chi-slot" data-chi="middle">
        <div class="chi-slot-title">Chi Giữa (5)</div>
        <div class="chi-slot-cards" data-cards="middle"></div>
      </div>
      <div class="chi-slot" data-chi="back">
        <div class="chi-slot-title">Chi Sau (5)</div>
        <div class="chi-slot-cards" data-cards="back"></div>
      </div>
    </div>
    <div class="tray">
      <div class="tray-title">Bài trên tay</div>
      <div class="tray-cards" data-cards="tray"></div>
    </div>
  `
  parent.appendChild(root)

  let tray: Card[] = []
  let front: Card[] = []
  let middle: Card[] = []
  let back: Card[] = []
  let selectedKey: string | null = null
  let enabled = true

  const zoneCards: Record<Zone, () => Card[]> = {
    tray: () => tray,
    front: () => front,
    middle: () => middle,
    back: () => back,
  }

  function findCard(key: string): { card: Card; zone: Zone; index: number } | null {
    for (const zone of ['tray', 'front', 'middle', 'back'] as Zone[]) {
      const list = zoneCards[zone]()
      const index = list.findIndex((c) => cardKey(c) === key)
      if (index >= 0) return { card: list[index]!, zone, index }
    }
    return null
  }

  function removeFromZone(zone: Zone, index: number): Card {
    const list = zoneCards[zone]()
    return list.splice(index, 1)[0]!
  }

  function placeInChi(chi: ChiId, card: Card): boolean {
    const list = zoneCards[chi]()
    if (list.length >= CHI_CAPACITY[chi]) return false
    list.push(card)
    return true
  }

  function setSelected(key: string | null): void {
    selectedKey = key
    render()
  }

  function onCardClick(key: string): void {
    if (!enabled) return
    if (selectedKey === key) {
      setSelected(null)
      return
    }
    if (selectedKey === null) {
      setSelected(key)
      return
    }
    // Move selected onto the zone of the clicked card (swap if same chi capacity ok)
    const from = findCard(selectedKey)
    const to = findCard(key)
    if (!from || !to) {
      setSelected(key)
      return
    }
    if (from.zone === to.zone) {
      setSelected(key)
      return
    }
    // If target is tray: move selected to tray
    if (to.zone === 'tray') {
      const card = removeFromZone(from.zone, from.index)
      tray.push(card)
      setSelected(null)
      return
    }
    // Target is a chi: try move selected into that chi (replace click target back to tray if full)
    const chi = to.zone as ChiId
    const list = zoneCards[chi]()
    if (list.length < CHI_CAPACITY[chi]) {
      const card = removeFromZone(from.zone, from.index)
      list.push(card)
      setSelected(null)
      return
    }
    // Full: swap selected with clicked
    const a = removeFromZone(from.zone, from.index)
    const refreshed = findCard(key)
    if (!refreshed) {
      // put back
      zoneCards[from.zone]().splice(from.index, 0, a)
      setSelected(null)
      return
    }
    const b = removeFromZone(refreshed.zone, refreshed.index)
    zoneCards[refreshed.zone]().splice(refreshed.index, 0, a)
    if (from.zone === 'tray') {
      tray.push(b)
    } else {
      placeInChi(from.zone as ChiId, b)
    }
    setSelected(null)
  }

  function onSlotClick(chi: ChiId): void {
    if (!enabled || selectedKey === null) return
    const from = findCard(selectedKey)
    if (!from) return
    if (from.zone === chi) {
      setSelected(null)
      return
    }
    const list = zoneCards[chi]()
    if (list.length >= CHI_CAPACITY[chi]) return
    const card = removeFromZone(from.zone, from.index)
    list.push(card)
    setSelected(null)
  }

  function renderZone(zone: Zone, container: HTMLElement): void {
    container.innerHTML = ''
    for (const card of zoneCards[zone]()) {
      const key = cardKey(card)
      container.appendChild(
        createFaceCard(card, {
          selected: selectedKey === key,
          onClick: () => onCardClick(key),
        }),
      )
    }
  }

  function render(): void {
    renderZone('tray', root.querySelector('[data-cards="tray"]')!)
    renderZone('front', root.querySelector('[data-cards="front"]')!)
    renderZone('middle', root.querySelector('[data-cards="middle"]')!)
    renderZone('back', root.querySelector('[data-cards="back"]')!)

    for (const chi of ['front', 'middle', 'back'] as ChiId[]) {
      const slot = root.querySelector<HTMLElement>(`[data-chi="${chi}"]`)!
      slot.classList.toggle('drop-target', selectedKey !== null && enabled)
    }
  }

  // Slot background click (not on a card) places selected
  for (const chi of ['front', 'middle', 'back'] as ChiId[]) {
    const slot = root.querySelector<HTMLElement>(`[data-chi="${chi}"]`)!
    slot.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.card')) return
      onSlotClick(chi)
    })
  }

  function setHand(hand: Card[]): void {
    tray = hand.slice()
    front = []
    middle = []
    back = []
    selectedKey = null
    render()
  }

  function applyArrangement(arr: Arrangement): void {
    front = arr.front.slice()
    middle = arr.middle.slice()
    back = arr.back.slice()
    tray = []
    selectedKey = null
    render()
  }

  function getArrangement(): Arrangement | null {
    if (front.length !== 3 || middle.length !== 5 || back.length !== 5) {
      return null
    }
    if (tray.length !== 0) return null
    return {
      front: front.slice(),
      middle: middle.slice(),
      back: back.slice(),
    }
  }

  function getAllCards(): Card[] {
    return [...tray, ...front, ...middle, ...back]
  }

  function setEnabled(on: boolean): void {
    enabled = on
    root.querySelectorAll<HTMLButtonElement>('.card.face').forEach((el) => {
      el.disabled = !on
    })
    render()
  }

  function clear(): void {
    tray = []
    front = []
    middle = []
    back = []
    selectedKey = null
    render()
  }

  render()

  return {
    root,
    setHand,
    applyArrangement,
    getArrangement,
    getAllCards,
    setEnabled,
    clear,
  }
}
