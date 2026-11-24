export type SeatScoreRow = {
  name: string
  chi: number
  soAt: number
  total: number
  cumulative: number
}

export type ScoreboardView = {
  root: HTMLElement
  renderRound: (rows: SeatScoreRow[]) => void
  renderCumulativeOnly: (names: string[], totals: number[]) => void
  clearRound: () => void
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

/**
 * Sidebar: per-round chi / So Át / tổng + cộng dồn, plus host for Ván mới.
 */
export function createScoreboard(parent: HTMLElement): ScoreboardView {
  const root = document.createElement('aside')
  root.className = 'sidebar'
  root.innerHTML = `
    <h2>Bảng điểm</h2>
    <div class="score-section" data-round>
      <p>Ván này</p>
      <table class="score-table">
        <thead>
          <tr>
            <th>Ghế</th>
            <th>Chi</th>
            <th>So Át</th>
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

  function renderRound(rows: SeatScoreRow[]): void {
    roundSection.hidden = false
    roundBody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${r.name}</td>
        <td class="${ptsClass(r.chi)}">${formatPts(r.chi)}</td>
        <td class="${ptsClass(r.soAt)}">${formatPts(r.soAt)}</td>
        <td class="${ptsClass(r.total)}">${formatPts(r.total)}</td>
      </tr>`,
      )
      .join('')
    renderCumulative(
      rows.map((r) => r.name),
      rows.map((r) => r.cumulative),
    )
  }

  function renderCumulativeOnly(names: string[], totals: number[]): void {
    roundSection.hidden = true
    roundBody.innerHTML = ''
    renderCumulative(names, totals)
  }

  function clearRound(): void {
    roundSection.hidden = true
    roundBody.innerHTML = ''
  }

  // Initial empty cumulative
  renderCumulativeOnly([...SEAT_NAMES], [0, 0, 0, 0])

  return {
    root,
    renderRound,
    renderCumulativeOnly,
    clearRound,
  }
}

export function scoreboardActionsHost(view: ScoreboardView): HTMLElement {
  return view.root.querySelector<HTMLElement>('[data-actions]')!
}
