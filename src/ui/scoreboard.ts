export type SeatScoreRow = {
  name: string
  chi: number
  soAt: number
  atLon: number
  heo?: number
  total: number
  cumulative: number
  statusLabel?: string
}

export type ScoreboardView = {
  root: HTMLElement
  renderRound: (rows: SeatScoreRow[], opts?: { heoPot?: number; heoNote?: string }) => void
  renderCumulativeOnly: (
    names: string[],
    totals: number[],
    opts?: { heoPot?: number },
  ) => void
  clearRound: () => void
  setHeoPot: (pot: number, note?: string) => void
}

const SEAT_NAMES = ['Bạn', 'Bot 1', 'Bot 2', 'Bot 3'] as const

export function seatNames(): readonly string[] {
  return SEAT_NAMES
}

function formatPts(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}

function ptsClass(n: number): string {
  if (n > 0) return 'positive'
  if (n < 0) return 'negative'
  return ''
}

export function createScoreboard(parent: HTMLElement): ScoreboardView {
  const root = document.createElement('aside')
  root.className = 'sidebar'
  root.innerHTML = `
    <h2>Bảng điểm</h2>
    <div class="heo-pot-banner" data-heo-banner hidden>
      <span class="heo-pot-label">Rổ heo</span>
      <strong class="heo-pot-value" data-heo-value>0</strong>
      <span class="heo-pot-note" data-heo-note></span>
    </div>
    <div class="score-section" data-round>
      <p>Ván này</p>
      <table class="score-table">
        <thead>
          <tr>
            <th>Ghế</th>
            <th>Chi</th>
            <th>So Át</th>
            <th>Át to</th>
            <th>Heo</th>
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody data-round-body></tbody>
      </table>
    </div>
    <div class="score-section" data-cum>
      <p>Cộng dồn</p>
      <table class="score-table">
        <thead>
          <tr>
            <th>Ghế</th>
            <th>Điểm</th>
          </tr>
        </thead>
        <tbody data-cum-body></tbody>
      </table>
    </div>
    <div data-actions></div>
  `
  parent.appendChild(root)

  const roundBody = root.querySelector<HTMLElement>('[data-round-body]')!
  const cumBody = root.querySelector<HTMLElement>('[data-cum-body]')!
  const roundSection = root.querySelector<HTMLElement>('[data-round]')!
  const heoBanner = root.querySelector<HTMLElement>('[data-heo-banner]')!
  const heoValue = root.querySelector<HTMLElement>('[data-heo-value]')!
  const heoNote = root.querySelector<HTMLElement>('[data-heo-note]')!

  function setHeoPot(pot: number, note = ''): void {
    if (pot < 0) {
      heoBanner.hidden = true
      return
    }
    heoBanner.hidden = false
    heoValue.textContent = String(pot)
    heoNote.textContent = note
  }

  function renderCumulative(names: string[], totals: number[]): void {
    cumBody.innerHTML = names
      .map(
        (name, i) => `
      <tr>
        <td>${name}</td>
        <td class="${ptsClass(totals[i]!)}">${formatPts(totals[i]!)}</td>
      </tr>`,
      )
      .join('')
  }

  function renderRound(
    rows: SeatScoreRow[],
    opts?: { heoPot?: number; heoNote?: string },
  ): void {
    roundSection.hidden = false
    roundBody.innerHTML = rows
      .map((r) => {
        const label = r.statusLabel
          ? `<div class="seat-status">${r.statusLabel}</div>`
          : ''
        const heo = r.heo ?? 0
        return `
      <tr>
        <td>${r.name}${label}</td>
        <td class="${ptsClass(r.chi)}">${formatPts(r.chi)}</td>
        <td class="${ptsClass(r.soAt)}">${formatPts(r.soAt)}</td>
        <td class="${ptsClass(r.atLon)}">${formatPts(r.atLon)}</td>
        <td class="${ptsClass(heo)}">${formatPts(heo)}</td>
        <td class="${ptsClass(r.total)}">${formatPts(r.total)}</td>
      </tr>`
      })
      .join('')
    renderCumulative(
      rows.map((r) => r.name),
      rows.map((r) => r.cumulative),
    )
    if (opts?.heoPot !== undefined) {
      setHeoPot(opts.heoPot, opts.heoNote ?? '')
    }
  }

  function renderCumulativeOnly(
    names: string[],
    totals: number[],
    opts?: { heoPot?: number },
  ): void {
    roundSection.hidden = true
    roundBody.innerHTML = ''
    renderCumulative(names, totals)
    if (opts?.heoPot !== undefined) setHeoPot(opts.heoPot)
  }

  function clearRound(): void {
    roundSection.hidden = true
    roundBody.innerHTML = ''
  }

  renderCumulativeOnly([...SEAT_NAMES], [0, 0, 0, 0])

  return {
    root,
    renderRound,
    renderCumulativeOnly,
    clearRound,
    setHeoPot,
  }
}

export function scoreboardActionsHost(view: ScoreboardView): HTMLElement {
  return view.root.querySelector<HTMLElement>('[data-actions]')!
}
