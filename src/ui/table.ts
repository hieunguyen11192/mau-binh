import { optimizeHand } from '../ai/optimizer'
import { dealHands } from '../core/deal'
import { LEVELS, type LevelId } from '../core/levels'
import type { Arrangement, Card } from '../core/types'
import { playRound, type PlayRoundResult } from '../game/round'
import {
  createArrangeController,
  createBackCard,
  createFaceCard,
  createPeekToggleCard,
  type ArrangeController,
} from './arrange'
import {
  createScoreboard,
  scoreboardActionsHost,
  seatNames,
  type ScoreboardView,
} from './scoreboard'

type Phase = 'idle' | 'arrange' | 'result'

type GameState = {
  level: LevelId
  phase: Phase
  hands: [Card[], Card[], Card[], Card[]] | null
  lastResult: PlayRoundResult | null
  totals: number[]
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
  `

  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.hidden = true
  actions.innerHTML = `
    <button type="button" class="btn btn-warn" data-auto hidden>Xếp gợi ý</button>
    <button type="button" class="btn btn-primary" data-done>Xong</button>
    <button type="button" class="btn btn-danger" data-fold hidden>Úp bài</button>
    <button type="button" class="btn btn-special" data-claim hidden>Mậu binh đặc biệt</button>
    <span class="status-msg" data-status></span>
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
  mainCol.append(toolbar, actions, table)

  const scoreboard: ScoreboardView = createScoreboard(game)
  const arrange: ArrangeController = createArrangeController(arrangeHost)
  arrange.root.hidden = true

  game.prepend(mainCol)
  host.appendChild(game)

  const levelSelect = toolbar.querySelector<HTMLSelectElement>('[data-level]')!
  const dealBtn = toolbar.querySelector<HTMLButtonElement>('[data-deal]')!
  const autoBtn = actions.querySelector<HTMLButtonElement>('[data-auto]')!
  const doneBtn = actions.querySelector<HTMLButtonElement>('[data-done]')!
  const foldBtn = actions.querySelector<HTMLButtonElement>('[data-fold]')!
  const claimBtn = actions.querySelector<HTMLButtonElement>('[data-claim]')!
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
  }

  function setStatus(msg: string): void {
    statusEl.textContent = msg
  }

  function syncActionButtons(): void {
    const def = LEVELS[state.level]
    const arranging = state.phase === 'arrange'
    actions.hidden = !arranging
    autoBtn.hidden = !(arranging && def.auto)
    foldBtn.hidden = !(arranging && def.fold)
    claimBtn.hidden = !(arranging && def.claimAid)
    doneBtn.disabled = !arranging
    autoBtn.disabled = !arranging
    foldBtn.disabled = !arranging
    claimBtn.disabled = !arranging
    dealBtn.disabled = state.phase === 'arrange'
    levelSelect.disabled = state.phase === 'arrange'
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

  function renderBotReveal(arrangements: Arrangement[]): void {
    for (let i = 0; i < 3; ++i) {
      const handEl = botsRow.querySelector<HTMLElement>(
        `[data-bot-hand="${i + 1}"]`,
      )!
      handEl.innerHTML = ''
      handEl.className = 'bot-chis'
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
      const handEl = botsRow.querySelector<HTMLElement>(`[data-bot-hand="${i}"]`)!
      handEl.innerHTML = ''
      handEl.className = 'bot-hand'
    }
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
    scoreboard.renderCumulativeOnly([...seatNames()], state.totals)
    if (LEVELS[state.level].peek) {
      setStatus('Xếp 3 chi rồi Xong. Click bài bot để xem tạm (peek).')
    } else {
      setStatus('Xếp bài vào 3 chi, rồi nhấn Xong.')
    }
    syncActionButtons()
  }

  function finish(human: Arrangement | 'fold' | 'claim'): void {
    if (!state.hands || state.phase !== 'arrange') return

    if (human !== 'fold' && human !== 'claim') {
      // already validated arrangement
    }

    const result = playRound({
      level: state.level,
      human,
      hands: state.hands,
    })
    state.lastResult = result
    state.phase = 'result'

    for (let i = 0; i < 4; ++i) {
      state.totals[i]! += result.roundScores[i]!
    }

    arrange.setEnabled(false)
    if (human === 'fold') {
      // keep tray as-is; show folded status
      setStatus('Bạn đã úp bài. So Át vẫn tính.')
    } else if (human === 'claim') {
      setStatus('Bạn khai Mậu binh đặc biệt.')
    } else {
      arrange.applyArrangement(human)
      setStatus('Lật bài — xem điểm bên phải.')
    }

    renderBotReveal(result.botArrangements)

    const names = seatNames()
    scoreboard.renderRound(
      names.map((name, i) => ({
        name,
        chi: result.chiScores[i]!,
        soAt: result.soAtScores[i]!,
        total: result.roundScores[i]!,
        cumulative: state.totals[i]!,
      })),
    )
    syncActionButtons()
  }

  function onDone(): void {
    const arr = arrange.getArrangement()
    if (!arr) {
      setStatus('Cần xếp đủ Chi Trước 3 / Giữa 5 / Sau 5.')
      return
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

  function onClaim(): void {
    if (!LEVELS[state.level].claimAid) return
    finish('claim')
  }

  function onNewRound(): void {
    state.phase = 'idle'
    state.hands = null
    state.lastResult = null
    arrange.clear()
    arrange.root.hidden = true
    clearBots()
    center.hidden = false
    center.textContent = 'Chọn độ khó rồi nhấn Chia bài.'
    scoreboard.clearRound()
    scoreboard.renderCumulativeOnly([...seatNames()], state.totals)
    setStatus('')
    syncActionButtons()
  }

  dealBtn.addEventListener('click', deal)
  autoBtn.addEventListener('click', onAuto)
  doneBtn.addEventListener('click', onDone)
  foldBtn.addEventListener('click', onFold)
  claimBtn.addEventListener('click', onClaim)
  newRoundBtn.addEventListener('click', onNewRound)
  levelSelect.addEventListener('change', () => {
    state.level = levelSelect.value as LevelId
    syncActionButtons()
  })

  syncActionButtons()
}
