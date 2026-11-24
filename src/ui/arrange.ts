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

const CHI_LABEL: Record<ChiId, string> = {
  front: 'Chi Trước',
  middle: 'Chi Giữa',
  back: 'Chi Sau',
}

/** Prefer filling strongest chi first (Sau → Giữa → Trước). */
const CHI_FILL_ORDER: ChiId[] = ['back', 'middle', 'front']

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
 * Warrior-style arrange: click a chi to target it, then click tray cards to
 * place. Click a card already in a chi to return it to the tray.
 */
export function createArrangeController(parent: HTMLElement): ArrangeController {
  const root = document.createElement('div')
  root.className = 'human-zone'
  root.innerHTML = `
    <p class="arrange-hint" data-hint></p>
    <div class="chi-slots">
      <div class="chi-slot" data-chi="front" role="button" tabindex="0">
        <div class="chi-slot-title" data-title="front">Chi Trước (0/3)</div>
        <div class="chi-slot-cards" data-cards="front"></div>
      </div>
      <div class="chi-slot" data-chi="middle" role="button" tabindex="0">
        <div class="chi-slot-title" data-title="middle">Chi Giữa (0/5)</div>
        <div class="chi-slot-cards" data-cards="middle"></div>
      </div>
      <div class="chi-slot" data-chi="back" role="button" tabindex="0">
        <div class="chi-slot-title" data-title="back">Chi Sau (0/5)</div>
        <div class="chi-slot-cards" data-cards="back"></div>
      </div>
    </div>
    <div class="tray">
      <div class="tray-header">
        <div class="tray-title">Bài trên tay</div>
        <div class="tray-sort">
          <button type="button" class="btn btn-sort" data-sort="suit" title="Nhóm theo chất">Theo chất</button>
          <button type="button" class="btn btn-sort" data-sort="rank" title="Từ nhỏ đến lớn">Nhỏ → lớn</button>
        </div>
      </div>
      <div class="tray-cards" data-cards="tray"></div>
    </div>
  `
  parent.appendChild(root)

  let tray: Card[] = []
  let front: Card[] = []
  let middle: Card[] = []
  let back: Card[] = []
  let activeChi: ChiId | null = null
  let enabled = true

  const hintEl = root.querySelector<HTMLElement>('[data-hint]')!
  const sortSuitBtn = root.querySelector<HTMLButtonElement>('[data-sort="suit"]')!
  const sortRankBtn = root.querySelector<HTMLButtonElement>('[data-sort="rank"]')!

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

  function nextOpenChi(prefer?: ChiId | null): ChiId | null {
    const order = prefer
      ? [prefer, ...CHI_FILL_ORDER.filter((c) => c !== prefer)]
      : CHI_FILL_ORDER
    for (const chi of order) {
      if (zoneCards[chi]().length < CHI_CAPACITY[chi]) return chi
    }
    return null
  }

  function setActiveChi(chi: ChiId | null): void {
    activeChi = chi
    render()
  }

  /** Click chi header/slot → select target (toggle off if same & empty click). */
  function onChiSelect(chi: ChiId): void {
    if (!enabled) return
    if (activeChi === chi) {
      setActiveChi(null)
      return
    }
    if (zoneCards[chi]().length >= CHI_CAPACITY[chi]) {
      // Full chi: still allow select so user can see it; placing won't add
      setActiveChi(chi)
      return
    }
    setActiveChi(chi)
  }

  /** Tray card → place into active chi. Chi card → return to tray. */
  function onCardClick(key: string): void {
    if (!enabled) return
    const found = findCard(key)
    if (!found) return

    // Card in a chi → return to tray; keep/focus that chi for quick refill
    if (found.zone !== 'tray') {
      const card = removeFromZone(found.zone, found.index)
      tray.push(card)
      if (activeChi === null) activeChi = found.zone as ChiId
      render()
      return
    }

    const chi =
      activeChi !== null && zoneCards[activeChi]().length < CHI_CAPACITY[activeChi]
        ? activeChi
        : nextOpenChi(activeChi)
    if (!chi) return

    const card = removeFromZone('tray', found.index)
    const list = zoneCards[chi]()
    list.push(card)
    activeChi = list.length >= CHI_CAPACITY[chi] ? nextOpenChi(chi) : chi
    render()
  }

  function renderZone(zone: Zone, container: HTMLElement): void {
    container.innerHTML = ''
    for (const card of zoneCards[zone]()) {
      const key = cardKey(card)
      container.appendChild(
        createFaceCard(card, {
          onClick: () => onCardClick(key),
        }),
      )
    }
  }

  function compareBySuit(a: Card, b: Card): number {
    if (a.suit !== b.suit) return a.suit - b.suit
    return a.rank - b.rank
  }

  function compareByRank(a: Card, b: Card): number {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.suit - b.suit
  }

  function sortTray(mode: 'suit' | 'rank'): void {
    if (!enabled || tray.length === 0) return
    tray = tray.slice().sort(mode === 'suit' ? compareBySuit : compareByRank)
    render()
  }

  function hintText(): string {
    if (!enabled) return ''
    if (tray.length === 0) return 'Đủ 13 lá — nhấn Xong khi chắc chắn.'
    if (activeChi === null) {
      return 'Bấm chọn một chi, rồi bấm bài trên tay để xếp vào.'
    }
    const n = zoneCards[activeChi]().length
    const cap = CHI_CAPACITY[activeChi]
    if (n >= cap) {
      return `${CHI_LABEL[activeChi]} đã đủ ${cap} lá — chọn chi khác hoặc trả bài về khay.`
    }
    return `Đang xếp ${CHI_LABEL[activeChi]} (${n}/${cap}) — bấm bài trên tay để thêm.`
  }

  function render(): void {
    renderZone('tray', root.querySelector('[data-cards="tray"]')!)
    renderZone('front', root.querySelector('[data-cards="front"]')!)
    renderZone('middle', root.querySelector('[data-cards="middle"]')!)
    renderZone('back', root.querySelector('[data-cards="back"]')!)

    for (const chi of ['front', 'middle', 'back'] as ChiId[]) {
      const slot = root.querySelector<HTMLElement>(`[data-chi="${chi}"]`)!
      const n = zoneCards[chi]().length
      const cap = CHI_CAPACITY[chi]
      slot.classList.toggle('active', activeChi === chi && enabled)
      slot.classList.toggle('full', n >= cap)
      const title = root.querySelector<HTMLElement>(`[data-title="${chi}"]`)!
      title.textContent = `${CHI_LABEL[chi]} (${n}/${cap})`
    }

    hintEl.textContent = hintText()

    const canSort = enabled && tray.length > 0
    sortSuitBtn.disabled = !canSort
    sortRankBtn.disabled = !canSort

    root.querySelectorAll<HTMLButtonElement>('.card.face').forEach((el) => {
      el.disabled = !enabled
    })
  }

  sortSuitBtn.addEventListener('click', () => sortTray('suit'))
  sortRankBtn.addEventListener('click', () => sortTray('rank'))

  for (const chi of ['front', 'middle', 'back'] as ChiId[]) {
    const slot = root.querySelector<HTMLElement>(`[data-chi="${chi}"]`)!
    slot.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.card')) return
      onChiSelect(chi)
    })
    slot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onChiSelect(chi)
      }
    })
  }

  function setHand(hand: Card[]): void {
    tray = hand.slice()
    front = []
    middle = []
    back = []
    activeChi = 'back'
    render()
  }

  function applyArrangement(arr: Arrangement): void {
    front = arr.front.slice()
    middle = arr.middle.slice()
    back = arr.back.slice()
    tray = []
    activeChi = null
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
    render()
  }

  function clear(): void {
    tray = []
    front = []
    middle = []
    back = []
    activeChi = null
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
