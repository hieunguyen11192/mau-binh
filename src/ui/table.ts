import { optimizeHand } from '../ai/optimizer'
import { dealHands } from '../core/deal'
import { isFoul } from '../core/hand'
import { LEVELS, type LevelId } from '../core/levels'
import {
  CLAIMABLE_KINDS,
  SPECIAL_NAMES_VI,
  SPECIAL_POINTS,
  detectSpecial,
  type SpecialKind,
} from '../core/special'
import type { Arrangement, Card } from '../core/types'
import {
  playRound,
  type PlayRoundResult,
  type SeatRoundStatus,
} from '../game/round'
import {
  createArrangeController,
  createBackCard,
  createFaceCard,
  createPeekToggleCard,
  type ArrangeController,
} from './arrange'
import { createGuideSheet } from './guide'
import { createRulesForm } from './rules-form'
import {
  createScoreboard,
  scoreboardActionsHost,
  seatNames,
  type ScoreboardView,
} from './scoreboard'

/** VI label for scoreboard / seat badge from round outcome. */
function statusLabelVi(s: SeatRoundStatus): string | undefined {
  if (s.foul) return 'Binh'
  if (s.specialKind > 0) {
    return SPECIAL_NAMES_VI[s.specialKind as SpecialKind] || 'Đặc biệt'
  }
  if (s.folded) return 'Úp bài'
  return undefined
}

type Phase = 'idle' | 'arrange' | 'result'

type GameState = {
  level: LevelId
  phase: Phase
  hands: [Card[], Card[], Card[], Card[]] | null
  lastResult: PlayRoundResult | null
  totals: number[]
  heoPot: number
}

/**
 * Mount full Vietnamese table UI into `host` (#app).
 */
export function mountTable(host: HTMLElement): void {
  host.innerHTML = ''
  host.className = ''

  const game = document.createElement('div')
  game.className = 'game'

  const mainCol = document.createElement('div')
  mainCol.className = 'table-area'

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'
  toolbar.innerHTML = `
    <h1>Mậu Binh</h1>
    <label>
      Độ khó
      <select data-level>
        <option value="jo">Jô</option>
        <option value="dam">Đầm</option>
        <option value="gia">Già</option>
        <option value="at">Át</option>
      </select>
    </label>
    <button type="button" class="btn btn-primary" data-deal>Chia bài</button>
    <button type="button" class="btn" data-guide>Hướng dẫn</button>
  `

  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.hidden = true
  actions.innerHTML = `
    <div class="actions-row">
      <button type="button" class="btn btn-warn" data-auto hidden>Xếp gợi ý</button>
      <button type="button" class="btn btn-primary" data-done>Xong</button>
      <button type="button" class="btn btn-danger" data-fold hidden>Úp bài</button>
      <span class="status-msg" data-status></span>
    </div>
    <div class="claim-group" data-claim-group hidden>
      <span class="claim-group-label">Khai đặc biệt:</span>
      ${CLAIMABLE_KINDS.map(
        (k) =>
          `<button type="button" class="btn btn-special" data-claim="${k}">${SPECIAL_NAMES_VI[k]} (+${SPECIAL_POINTS[k]})</button>`,
      ).join('')}
    </div>
  `

  const table = document.createElement('div')
  table.className = 'table'

  const botsRow = document.createElement('div')
  botsRow.className = 'bots-row'
  botsRow.innerHTML = `
    <div class="seat" data-bot="1"><div class="seat-label">Bot 1</div><div class="bot-hand" data-bot-hand="1"></div></div>
    <div class="seat" data-bot="2"><div class="seat-label">Bot 2</div><div class="bot-hand" data-bot-hand="2"></div></div>
    <div class="seat" data-bot="3"><div class="seat-label">Bot 3</div><div class="bot-hand" data-bot-hand="3"></div></div>
  `

  const center = document.createElement('div')
  center.className = 'empty-hint'
  center.dataset.center = ''
  center.textContent = 'Chọn độ khó rồi nhấn Chia bài.'

  const humanSeat = document.createElement('div')
  humanSeat.className = 'seat human'
  humanSeat.innerHTML = `<div class="seat-label">Bạn</div>`
  const arrangeHost = document.createElement('div')
  humanSeat.appendChild(arrangeHost)

  table.append(botsRow, center, humanSeat)

  const rulesForm = createRulesForm()
  mainCol.append(toolbar, rulesForm.root, actions, table)

  const scoreboard: ScoreboardView = createScoreboard(game)
  const arrange: ArrangeController = createArrangeController(arrangeHost)
  arrange.root.hidden = true

  game.prepend(mainCol)
  host.appendChild(game)

  const guide = createGuideSheet()
  host.appendChild(guide.root)

  const levelSelect = toolbar.querySelector<HTMLSelectElement>('[data-level]')!
  const dealBtn = toolbar.querySelector<HTMLButtonElement>('[data-deal]')!
  const guideBtn = toolbar.querySelector<HTMLButtonElement>('[data-guide]')!
  const autoBtn = actions.querySelector<HTMLButtonElement>('[data-auto]')!
  const doneBtn = actions.querySelector<HTMLButtonElement>('[data-done]')!
  const foldBtn = actions.querySelector<HTMLButtonElement>('[data-fold]')!
  const claimGroup = actions.querySelector<HTMLElement>('[data-claim-group]')!
  const claimBtns = CLAIMABLE_KINDS.map(
    (k) => actions.querySelector<HTMLButtonElement>(`[data-claim="${k}"]`)!,
  )
  const statusEl = actions.querySelector<HTMLElement>('[data-status]')!

  const newRoundBtn = document.createElement('button')
  newRoundBtn.type = 'button'
  newRoundBtn.className = 'btn btn-primary'
  newRoundBtn.textContent = 'Ván mới'
  newRoundBtn.hidden = true
  scoreboardActionsHost(scoreboard).appendChild(newRoundBtn)

  const state: GameState = {
    level: 'jo',
    phase: 'idle',
    hands: null,
    lastResult: null,
    totals: [0, 0, 0, 0],
    heoPot: 0,
  }

  function setStatus(msg: string): void {
    statusEl.textContent = msg
  }

  function syncClaimButtons(): void {
    const arranging = state.phase === 'arrange'
    // Claim always available while arranging (like 13-warriors); wrong claim → fold.
    claimGroup.hidden = !arranging
    const detected =
      arranging && state.hands ? detectSpecial(state.hands[0]).kind : 0
    const aid = LEVELS[state.level].claimAid
    for (const btn of claimBtns) {
      const kind = Number(btn.dataset.claim) as SpecialKind
      btn.disabled = !arranging
      const match = aid && detected === kind
      btn.classList.toggle('available', match)
      btn.title = match
        ? `Khai ${SPECIAL_NAMES_VI[kind]} — +${SPECIAL_POINTS[kind]} mỗi nhà`
        : `Khai ${SPECIAL_NAMES_VI[kind]} (+${SPECIAL_POINTS[kind]}/nhà). Sai → tính như úp bài.`
    }
  }

  function syncActionButtons(): void {
    const def = LEVELS[state.level]
    const arranging = state.phase === 'arrange'
    actions.hidden = !arranging
    autoBtn.hidden = !(arranging && def.auto)
    foldBtn.hidden = !(arranging && def.fold)
    doneBtn.disabled = !arranging
    autoBtn.disabled = !arranging
    foldBtn.disabled = !arranging
    syncClaimButtons()
    dealBtn.disabled = state.phase === 'arrange'
    levelSelect.disabled = state.phase === 'arrange'
    rulesForm.setEnabled(state.phase !== 'arrange')
    newRoundBtn.hidden = state.phase !== 'result'
  }

  function renderBotsFaceDown(): void {
    const canPeek = LEVELS[state.level].peek
    for (let i = 1; i <= 3; ++i) {
      const handEl = botsRow.querySelector<HTMLElement>(`[data-bot-hand="${i}"]`)!
      handEl.innerHTML = ''
      handEl.className = 'bot-hand'
      const botHand = state.hands![i]!
      for (let c = 0; c < 13; ++c) {
        if (canPeek) {
          handEl.appendChild(createPeekToggleCard(botHand[c]!, true))
        } else {
          handEl.appendChild(createBackCard(true))
        }
      }
    }
  }

  function renderBotReveal(
    arrangements: Arrangement[],
    seatStatuses: SeatRoundStatus[],
  ): void {
    for (let i = 0; i < 3; ++i) {
      const seatEl = botsRow.querySelector<HTMLElement>(`[data-bot="${i + 1}"]`)!
      const labelEl = seatEl.querySelector<HTMLElement>('.seat-label')!
      const handEl = botsRow.querySelector<HTMLElement>(
        `[data-bot-hand="${i + 1}"]`,
      )!
      const status = seatStatuses[i + 1]!
      const badge = statusLabelVi(status)
      labelEl.textContent = badge ? `Bot ${i + 1} · ${badge}` : `Bot ${i + 1}`

      handEl.innerHTML = ''
      handEl.className = 'bot-chis'
      if (status.folded) {
        handEl.classList.add('is-folded')
        const foldBadge = document.createElement('div')
        foldBadge.className = 'fold-badge'
        foldBadge.textContent = 'Úp bài'
        handEl.appendChild(foldBadge)
        continue
      }

      if (status.specialKind > 0) {
        handEl.classList.add('is-special')
        const specialBadge = document.createElement('div')
        specialBadge.className = 'special-badge'
        specialBadge.textContent =
          SPECIAL_NAMES_VI[status.specialKind as SpecialKind] || 'Đặc biệt'
        handEl.appendChild(specialBadge)
      }

      const arr = arrangements[i]!
      const rows: { tag: string; cards: Card[] }[] = [
        { tag: 'Trước', cards: arr.front },
        { tag: 'Giữa', cards: arr.middle },
        { tag: 'Sau', cards: arr.back },
      ]
      for (const row of rows) {
        const rowEl = document.createElement('div')
        rowEl.className = 'chi-row'
        const tag = document.createElement('span')
        tag.className = 'chi-tag'
        tag.textContent = row.tag
        rowEl.appendChild(tag)
        for (const card of row.cards) {
          const el = createFaceCard(card, { compact: true })
          el.classList.add('reveal-enter')
          el.disabled = true
          rowEl.appendChild(el)
        }
        handEl.appendChild(rowEl)
      }
    }
  }

  function clearBots(): void {
    for (let i = 1; i <= 3; ++i) {
      const seatEl = botsRow.querySelector<HTMLElement>(`[data-bot="${i}"]`)!
      const labelEl = seatEl.querySelector<HTMLElement>('.seat-label')!
      labelEl.textContent = `Bot ${i}`
      const handEl = botsRow.querySelector<HTMLElement>(`[data-bot-hand="${i}"]`)!
      handEl.innerHTML = ''
      handEl.className = 'bot-hand'
    }
  }

  function setHumanSeatLabel(status: SeatRoundStatus | null): void {
    const labelEl = humanSeat.querySelector<HTMLElement>('.seat-label')!
    const badge = status ? statusLabelVi(status) : undefined
    labelEl.textContent = badge ? `Bạn · ${badge}` : 'Bạn'
  }

  function deal(): void {
    state.level = levelSelect.value as LevelId
    state.hands = dealHands()
    state.lastResult = null
    state.phase = 'arrange'
    center.hidden = true
    arrange.root.hidden = false
    arrange.setHand(state.hands[0])
    arrange.setEnabled(true)
    renderBotsFaceDown()
    scoreboard.clearRound()
    const rules = rulesForm.getRules()
    scoreboard.renderCumulativeOnly([...seatNames()], state.totals, {
      heoPot: rules.heoEnabled ? state.heoPot : -1,
    })
    const special = detectSpecial(state.hands[0])
    if (LEVELS[state.level].claimAid && special.kind > 0) {
      setStatus(
        `Có ${SPECIAL_NAMES_VI[special.kind]} — bấm nút Khai phía trên, hoặc xếp chi thường.`,
      )
    } else if (LEVELS[state.level].peek) {
      setStatus('Xếp chi hoặc Khai đặc biệt. Peek: click bài bot.')
    } else {
      setStatus('Xếp chi hoặc bấm Khai đặc biệt, rồi Xong.')
    }
    syncActionButtons()
  }

  function finish(human: Arrangement | 'fold' | 'claim'): void {
    if (!state.hands || state.phase !== 'arrange') return

    const rules = rulesForm.getRules()
    const result = playRound({
      level: state.level,
      human,
      hands: state.hands,
      rules,
      heoPotBefore: state.heoPot,
    })
    state.lastResult = result
    state.phase = 'result'
    state.heoPot = result.heoPotAfter

    for (let i = 0; i < 4; ++i) {
      state.totals[i]! += result.roundScores[i]!
    }

    const humanStatus = result.seatStatuses[0]!
    arrange.setEnabled(false)
    setHumanSeatLabel(humanStatus)

    if (human === 'fold') {
      setStatus('Bạn đã úp bài. So Át vẫn tính.')
    } else if (human === 'claim') {
      if (humanStatus.specialKind > 0) {
        const name = SPECIAL_NAMES_VI[humanStatus.specialKind as SpecialKind]
        setStatus(`Bạn khai ${name}.`)
      } else {
        setStatus('Không có mậu binh đặc biệt — tính như úp bài.')
      }
    } else if (humanStatus.foul) {
      arrange.applyArrangement(human)
      setStatus('Binh / xếp sai thứ tự chi — chi tính 0 (như úp bài).')
    } else {
      arrange.applyArrangement(human)
      setStatus('Lật bài — xem điểm bên phải.')
    }

    renderBotReveal(result.botArrangements, result.seatStatuses)

    const names = seatNames()
    const heoNote =
      result.heoScoopSeat !== null
        ? `· ${names[result.heoScoopSeat]} hốt rổ ${result.heoPotBeforePayout}`
        : rules.heoEnabled
          ? '· tích lũy'
          : ''
    scoreboard.renderRound(
      names.map((name, i) => ({
        name,
        chi: result.chiScores[i]!,
        soAt: result.soAtScores[i]!,
        atLon: result.atLonScores[i]!,
        heo: result.heoScores[i]!,
        total: result.roundScores[i]!,
        cumulative: state.totals[i]!,
        statusLabel: statusLabelVi(result.seatStatuses[i]!),
      })),
      {
        heoPot: rules.heoEnabled ? state.heoPot : -1,
        heoNote,
      },
    )
    syncActionButtons()
  }

  function onDone(): void {
    const arr = arrange.getArrangement()
    if (!arr) {
      setStatus('Cần xếp đủ Chi Trước 3 / Giữa 5 / Sau 5.')
      return
    }
    if (isFoul(arr.front, arr.middle, arr.back)) {
      const ok = window.confirm(
        'Binh — xếp sai thứ tự chi.\nTính như úp bài (chi = 0)?',
      )
      if (!ok) {
        setStatus('Binh / xếp sai thứ tự chi — hãy sửa lại rồi Xong.')
        return
      }
    }
    finish(arr)
  }

  function onAuto(): void {
    if (!state.hands || state.phase !== 'arrange') return
    if (!LEVELS[state.level].auto) return
    const arr = optimizeHand(state.hands[0], 0)
    arrange.applyArrangement(arr)
    setStatus('Đã xếp gợi ý — chỉnh lại nếu muốn, rồi Xong.')
  }

  function onFold(): void {
    if (!LEVELS[state.level].fold) return
    finish('fold')
  }

  function onClaim(kind: SpecialKind): void {
    if (!state.hands || state.phase !== 'arrange') return
    const special = detectSpecial(state.hands[0])
    if (special.kind === kind && kind > 0) {
      finish('claim')
      return
    }
    // Wrong claim → fold (do not auto-award a different special)
    finish('fold')
    setStatus(
      special.kind === 0
        ? `Không có ${SPECIAL_NAMES_VI[kind]} — tính như úp bài.`
        : `Khai sai (bài là ${SPECIAL_NAMES_VI[special.kind]}) — tính như úp bài.`,
    )
  }

  function onNewRound(): void {
    state.phase = 'idle'
    state.hands = null
    state.lastResult = null
    arrange.clear()
    arrange.root.hidden = true
    clearBots()
    setHumanSeatLabel(null)
    center.hidden = false
    center.textContent = 'Chọn độ khó rồi nhấn Chia bài.'
    scoreboard.clearRound()
    const rules = rulesForm.getRules()
    scoreboard.renderCumulativeOnly([...seatNames()], state.totals, {
      heoPot: rules.heoEnabled ? state.heoPot : -1,
    })
    setStatus('')
    syncActionButtons()
  }

  dealBtn.addEventListener('click', deal)
  guideBtn.addEventListener('click', () => guide.open())
  autoBtn.addEventListener('click', onAuto)
  doneBtn.addEventListener('click', onDone)
  foldBtn.addEventListener('click', onFold)
  for (const btn of claimBtns) {
    btn.addEventListener('click', () => {
      onClaim(Number(btn.dataset.claim) as SpecialKind)
    })
  }
  newRoundBtn.addEventListener('click', onNewRound)
  levelSelect.addEventListener('change', () => {
    state.level = levelSelect.value as LevelId
    syncActionButtons()
  })

  syncActionButtons()
}
