import {
  createRoom,
  fetchSnapshot,
  joinRoom,
  leaveRoom,
  revealRound,
  setHeoPot,
  startRound,
  submitPlay,
  updateSettings,
} from '../multiplayer/api'
import { scoreMultiplayerReveal } from '../multiplayer/score'
import { isMultiplayerConfigured } from '../multiplayer/supabase'
import {
  clearSession,
  loadSession,
  saveSession,
  type MpSession,
  type MpSnapshot,
} from '../multiplayer/types'
import { SPECIAL_NAMES_VI, type SpecialKind } from '../core/special'
import { detectSpecial } from '../core/special'
import { isFoul } from '../core/hand'
import {
  DEFAULT_TABLE_RULES,
  normalizeRules,
  type TableRules,
} from '../core/table-rules'
import type { Arrangement, Card } from '../core/types'
import type { SeatRoundStatus } from '../game/round'
import {
  createArrangeController,
  createFaceCard,
  type ArrangeController,
} from './arrange'
import { createRulesForm } from './rules-form'
import { createScoreboard, type ScoreboardView } from './scoreboard'

function statusLabelVi(s: SeatRoundStatus): string | undefined {
  if (s.foul) return 'Binh'
  if (s.specialKind > 0) {
    return SPECIAL_NAMES_VI[s.specialKind as SpecialKind] || 'Đặc biệt'
  }
  if (s.folded) return 'Úp bài'
  return undefined
}

/**
 * Multiplayer (friends) table: lobby → arrange → result.
 * Polls snapshot while in a room (RLS blocks direct realtime selects).
 */
export function mountMultiplayer(host: HTMLElement, onBack: () => void): void {
  host.innerHTML = ''
  host.className = ''

  if (!isMultiplayerConfigured()) {
    host.innerHTML = `
      <div class="mp-shell">
        <p class="mp-error">Chưa cấu hình Supabase (.env.local).</p>
        <button type="button" class="btn" data-back>Về chế độ máy</button>
      </div>`
    host.querySelector('[data-back]')!.addEventListener('click', onBack)
    return
  }

  const shell = document.createElement('div')
  shell.className = 'mp-shell game'
  host.appendChild(shell)

  const mainCol = document.createElement('div')
  mainCol.className = 'table-area mp-main'
  shell.appendChild(mainCol)

  let session: MpSession | null = loadSession()
  let snapshot: MpSnapshot | null = null
  let pollTimer: number | null = null
  let totals = [0, 0, 0, 0]
  let arrange: ArrangeController | null = null
  let lobbyRules = createRulesForm(DEFAULT_TABLE_RULES)
  let lastHeoSyncedRound = -1

  const scoreboard: ScoreboardView = createScoreboard(shell)
  scoreboard.root.hidden = true

  function currentRules(): TableRules {
    return normalizeRules(snapshot?.settings ?? DEFAULT_TABLE_RULES)
  }

  function leaveBeacon(): void {
    if (!session) return
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return
    void fetch(`${url}/rest/v1/rpc/mb_leave_room`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_room_id: session.roomId,
        p_token: session.token,
      }),
      keepalive: true,
    })
  }

  async function doLeave(): Promise<void> {
    stopPoll()
    const s = session
    if (s) {
      try {
        await leaveRoom(s.roomId, s.token)
      } catch {
        leaveBeacon()
      }
    }
    clearSession()
    session = null
    snapshot = null
    arrange = null
    renderLobby()
  }

  function stopPoll(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPoll(): void {
    stopPoll()
    pollTimer = window.setInterval(() => {
      void refresh().catch(() => undefined)
    }, 800)
  }

  function playersKey(players: { seat: number; name: string }[]): string {
    return players
      .map((p) => `${p.seat}:${p.name}`)
      .sort()
      .join('|')
  }

  /** Update ghế trong lobby mà không remount form luật. */
  function paintLobbySeats(): void {
    if (!snapshot || snapshot.status !== 'lobby') return
    const panel = mainCol.querySelector('.mp-wait')
    if (!panel) {
      renderWaiting()
      return
    }
    const sub = panel.querySelector('.mp-sub')
    if (sub) {
      sub.textContent = `Chia sẻ mã phòng cho bạn. Đang chờ… (${snapshot.players.length}/4)`
    }
    const list = panel.querySelector('.mp-seats')
    if (list) {
      list.innerHTML = [0, 1, 2, 3]
        .map((s) => {
          const p = snapshot!.players.find((x) => x.seat === s)
          return p
            ? `<li class="mp-seat-filled">${s + 1}. ${escapeHtml(p.name)}${p.isHost ? ' (chủ)' : ''}</li>`
            : `<li class="mp-seat-empty">${s + 1}. — trống —</li>`
        })
        .join('')
    }
    const startBtn = panel.querySelector<HTMLButtonElement>('[data-start]')
    if (startBtn) startBtn.disabled = snapshot.players.length < 2
    const rulesLine = panel.querySelector('.rules-summary')
    if (rulesLine) {
      const rules = currentRules()
      rulesLine.textContent = `Đọ Át: ${rules.soAtEnabled ? `Yes (${rules.soAtAnte})` : 'No'} · Át to: ${rules.atLonEnabled ? `Yes (${rules.atLonAnte})` : 'No'} · Heo: ${rules.heoEnabled ? `Yes (${rules.heoAnte}) · rổ ${snapshot.heoPot ?? 0}` : 'No'}`
    }
  }

  let arrangeRound = -1

  async function refresh(): Promise<void> {
    if (!session) return
    const prev = snapshot
    snapshot = await fetchSnapshot(session.roomId, session.token)
    const phaseChanged =
      prev?.status !== snapshot.status ||
      prev?.currentRound !== snapshot.currentRound ||
      prev?.submitted !== snapshot.submitted

    if (phaseChanged) {
      await render()
      return
    }

    if (snapshot.status === 'lobby') {
      const changed =
        !prev ||
        playersKey(prev.players) !== playersKey(snapshot.players) ||
        prev.heoPot !== snapshot.heoPot
      if (changed) paintLobbySeats()
      return
    }

    if (snapshot.status === 'arranging' && prev) {
      const statusEl = mainCol.querySelector<HTMLElement>('[data-status-line]')
      if (statusEl) {
        statusEl.textContent = `Đã nộp ${snapshot.submitCount}/${snapshot.players.length}`
      }
    }
  }

  async function render(): Promise<void> {
    if (!session) {
      renderLobby()
      return
    }
    if (!snapshot) {
      snapshot = await fetchSnapshot(session.roomId, session.token)
    }
    if (snapshot.status === 'lobby') {
      renderWaiting()
    } else if (snapshot.status === 'arranging') {
      renderArrange()
    } else {
      await renderResult()
    }
  }

  function renderLobby(): void {
    stopPoll()
    scoreboard.root.hidden = true
    mainCol.innerHTML = ''

    const panel = document.createElement('div')
    panel.className = 'mp-panel'
    panel.innerHTML = `
      <h1>Chơi với bạn</h1>
      <p class="mp-sub">Tạo phòng hoặc nhập mã 6 ký tự. Cần ≥ 2 người (tối đa 4).</p>
      <label class="mp-field">Tên bạn
        <input type="text" data-name maxlength="24" placeholder="VD: Hieu" />
      </label>
      <div data-rules-host></div>
      <div class="mp-actions">
        <button type="button" class="btn btn-primary" data-create>Tạo phòng</button>
      </div>
      <div class="mp-join">
        <label class="mp-field">Mã phòng
          <input type="text" data-code maxlength="6" placeholder="ABC123" style="text-transform:uppercase" />
        </label>
        <button type="button" class="btn btn-special" data-join>Vào phòng</button>
      </div>
      <p class="status-msg" data-err></p>
      <button type="button" class="btn" data-back>← Chế độ</button>
    `
    mainCol.appendChild(panel)
    lobbyRules = createRulesForm(DEFAULT_TABLE_RULES)
    panel.querySelector('[data-rules-host]')!.appendChild(lobbyRules.root)

    const nameInput = panel.querySelector<HTMLInputElement>('[data-name]')!
    const codeInput = panel.querySelector<HTMLInputElement>('[data-code]')!
    const err = panel.querySelector<HTMLElement>('[data-err]')!

    panel.querySelector('[data-back]')!.addEventListener('click', () => {
      clearSession()
      onBack()
    })

    panel.querySelector('[data-create]')!.addEventListener('click', () => {
      void (async () => {
        err.textContent = ''
        try {
          session = await createRoom(
            nameInput.value.trim() || 'Host',
            lobbyRules.getRules(),
          )
          saveSession(session)
          snapshot = null
          totals = [0, 0, 0, 0]
          lastHeoSyncedRound = -1
          startPoll()
          await render()
        } catch (e) {
          err.textContent = e instanceof Error ? e.message : String(e)
        }
      })()
    })

    panel.querySelector('[data-join]')!.addEventListener('click', () => {
      void (async () => {
        err.textContent = ''
        try {
          session = await joinRoom(
            codeInput.value.trim(),
            nameInput.value.trim() || 'Player',
          )
          saveSession(session)
          snapshot = null
          totals = [0, 0, 0, 0]
          startPoll()
          await render()
        } catch (e) {
          err.textContent = e instanceof Error ? e.message : String(e)
        }
      })()
    })
  }

  function renderWaiting(): void {
    if (!session || !snapshot) return
    scoreboard.root.hidden = true
    mainCol.innerHTML = ''

    const panel = document.createElement('div')
    panel.className = 'mp-panel mp-wait'
    mainCol.appendChild(panel)

    const seats = [0, 1, 2, 3].map((s) => {
      const p = snapshot!.players.find((x) => x.seat === s)
      return p
        ? `<li class="mp-seat-filled">${s + 1}. ${escapeHtml(p.name)}${p.isHost ? ' (chủ)' : ''}</li>`
        : `<li class="mp-seat-empty">${s + 1}. — trống —</li>`
    })

    const rules = currentRules()
    panel.innerHTML = `
      <h1>Phòng <span class="mp-code">${escapeHtml(snapshot.code)}</span></h1>
      <p class="mp-sub">Chia sẻ mã phòng cho bạn. Đang chờ… (${snapshot.players.length}/4)</p>
      <ul class="mp-seats">${seats.join('')}</ul>
      <div class="rules-summary">
        Đọ Át: ${rules.soAtEnabled ? `Yes (${rules.soAtAnte})` : 'No'} ·
        Át to: ${rules.atLonEnabled ? `Yes (${rules.atLonAnte})` : 'No'} ·
        Heo: ${rules.heoEnabled ? `Yes (${rules.heoAnte}) · rổ ${snapshot.heoPot ?? 0}` : 'No'}
      </div>
      ${
        snapshot.isHost
          ? `<div data-host-rules></div><button type="button" class="btn" data-save-rules>Lưu luật</button>
             <button type="button" class="btn btn-primary" data-start ${snapshot.players.length < 2 ? 'disabled' : ''}>Bắt đầu ván</button>`
          : `<p class="status-msg">Chờ chủ phòng bắt đầu…</p>`
      }
      <p class="status-msg" data-err></p>
      <button type="button" class="btn" data-leave>Rời phòng</button>
    `

    if (snapshot.isHost) {
      const hostRules = createRulesForm(rules)
      panel.querySelector('[data-host-rules]')!.appendChild(hostRules.root)
      panel.querySelector('[data-save-rules]')!.addEventListener('click', () => {
        void (async () => {
          const err = panel.querySelector<HTMLElement>('[data-err]')!
          err.textContent = ''
          try {
            snapshot = await updateSettings(
              session!.roomId,
              session!.token,
              hostRules.getRules(),
            )
            await render()
          } catch (e) {
            err.textContent = e instanceof Error ? e.message : String(e)
          }
        })()
      })
    }

    panel.querySelector('[data-leave]')!.addEventListener('click', () => {
      void doLeave()
    })

    const startBtn = panel.querySelector<HTMLButtonElement>('[data-start]')
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        void (async () => {
          const err = panel!.querySelector<HTMLElement>('[data-err]')!
          err.textContent = ''
          try {
            snapshot = await startRound(session!.roomId, session!.token)
            await render()
          } catch (e) {
            err.textContent = e instanceof Error ? e.message : String(e)
          }
        })()
      })
    }
  }

  function renderArrange(): void {
    if (!session || !snapshot || !snapshot.myHand) return
    scoreboard.root.hidden = false

    // Keep current arrange UI if same round (poll soft-updates the counter)
    if (
      arrangeRound === snapshot.currentRound &&
      mainCol.querySelector('.mp-table') &&
      !snapshot.submitted
    ) {
      const statusEl = mainCol.querySelector<HTMLElement>('[data-status-line]')
      if (statusEl) {
        statusEl.textContent = `Đã nộp ${snapshot.submitCount}/${snapshot.players.length}`
      }
      return
    }

    arrangeRound = snapshot.currentRound
    mainCol.innerHTML = ''

    const table = document.createElement('div')
    table.className = 'mp-table'
    mainCol.appendChild(table)

    const names = [0, 1, 2, 3].map((s) => {
      const p = snapshot!.players.find((x) => x.seat === s)
      return p?.name ?? `Ghế ${s + 1}`
    })

    table.innerHTML = `
      <div class="toolbar">
        <h1>Phòng ${escapeHtml(snapshot.code)} · Ván ${snapshot.currentRound}</h1>
        <span class="status-msg" data-status-line>Đã nộp ${snapshot.submitCount}/${snapshot.players.length}</span>
        <button type="button" class="btn" data-leave>Rời</button>
      </div>
      <div class="actions">
        <div class="actions-row">
          <button type="button" class="btn btn-primary" data-done>Xong</button>
          <button type="button" class="btn btn-danger" data-fold>Úp bài</button>
          <span class="status-msg" data-status></span>
        </div>
        <div class="claim-group" data-claims></div>
      </div>
      <div class="mp-others" data-others></div>
      <div class="seat human" data-human>
        <div class="seat-label">Bạn (ghế ${snapshot.seat + 1})</div>
        <div data-arrange-host></div>
      </div>
    `

    table.querySelector('[data-leave]')!.addEventListener('click', () => {
      void doLeave()
    })

    const others = table.querySelector<HTMLElement>('[data-others]')!
    others.innerHTML = snapshot.players
      .filter((p) => p.seat !== snapshot!.seat)
      .map(
        (p) =>
          `<div class="mp-other-chip">Ghế ${p.seat + 1}: ${escapeHtml(p.name)} · đang xếp…</div>`,
      )
      .join('')

    const arrangeHost = table.querySelector<HTMLElement>('[data-arrange-host]')!
    arrangeHost.innerHTML = ''
    arrange = createArrangeController(arrangeHost)
    arrange.setHand(snapshot.myHand as Card[])
    arrange.setEnabled(!snapshot.submitted)

    const statusEl = table.querySelector<HTMLElement>('[data-status]')!
    const doneBtn = table.querySelector<HTMLButtonElement>('[data-done]')!
    const foldBtn = table.querySelector<HTMLButtonElement>('[data-fold]')!
    const claims = table.querySelector<HTMLElement>('[data-claims]')!

    if (snapshot.submitted) {
      statusEl.textContent = 'Đã nộp — chờ người khác…'
      doneBtn.disabled = true
      foldBtn.disabled = true
    }

    const special = detectSpecial(snapshot.myHand as Card[])
    claims.innerHTML = `<span class="claim-group-label">Khai đặc biệt:</span>`
    for (const kind of [4, 3, 2, 1] as SpecialKind[]) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn btn-special'
      btn.textContent = SPECIAL_NAMES_VI[kind]
      if (special.kind === kind) btn.classList.add('available')
      btn.disabled = snapshot.submitted
      btn.addEventListener('click', () => {
        void (async () => {
          if (special.kind !== kind) {
            await doSubmit('fold')
            statusEl.textContent = `Khai sai — tính úp bài.`
            return
          }
          await doSubmit('claim')
        })()
      })
      claims.appendChild(btn)
    }

    async function doSubmit(
      action: 'arrange' | 'fold' | 'claim',
      arrangement?: Arrangement,
    ): Promise<void> {
      if (!session) return
      try {
        snapshot = await submitPlay(
          session.roomId,
          session.token,
          action,
          arrangement ?? null,
        )
        await render()
      } catch (e) {
        statusEl.textContent = e instanceof Error ? e.message : String(e)
      }
    }

    doneBtn.addEventListener('click', () => {
      const arr = arrange!.getArrangement()
      if (!arr) {
        statusEl.textContent = 'Cần xếp đủ 3+5+5.'
        return
      }
      if (isFoul(arr.front, arr.middle, arr.back)) {
        if (
          !window.confirm('Binh — xếp sai thứ tự chi. Nộp như úp bài (chi = 0)?')
        ) {
          return
        }
      }
      void doSubmit('arrange', arr)
    })

    foldBtn.addEventListener('click', () => {
      void doSubmit('fold')
    })

    const rules = currentRules()
    scoreboard.renderCumulativeOnly(names, totals, {
      heoPot: rules.heoEnabled ? (snapshot.heoPot ?? 0) : -1,
    })
  }

  let lastScoredRound = 0

  async function renderResult(): Promise<void> {
    if (!session || !snapshot) return
    scoreboard.root.hidden = false
    mainCol.innerHTML = ''

    const table = document.createElement('div')
    table.className = 'mp-table'
    mainCol.appendChild(table)

    const reveal = await revealRound(session.roomId, session.token)
    const rules = currentRules()
    const scored = scoreMultiplayerReveal(reveal.hands, reveal.submissions, {
      rules,
      heoPotBefore: snapshot.heoPot ?? 0,
      occupied: [0, 1, 2, 3].map((i) =>
        reveal.players.some((p) => p.seat === i),
      ),
    })

    if (lastScoredRound !== reveal.round) {
      lastScoredRound = reveal.round
      for (let i = 0; i < 4; ++i) {
        totals[i]! += scored.roundScores[i]!
      }
    }

    // Persist heo pot once per round (any client; deterministic)
    if (
      rules.heoEnabled &&
      lastHeoSyncedRound !== reveal.round &&
      scored.heoPotAfter !== (snapshot.heoPot ?? 0)
    ) {
      lastHeoSyncedRound = reveal.round
      try {
        snapshot = await setHeoPot(
          session.roomId,
          session.token,
          scored.heoPotAfter,
        )
      } catch {
        /* ignore race */
      }
    }

    const names = [0, 1, 2, 3].map((s) => {
      const p = reveal.players.find((x) => x.seat === s)
      return p?.name ?? `Ghế ${s + 1}`
    })

    table.innerHTML = `
      <div class="toolbar">
        <h1>Kết quả ván ${reveal.round} · Phòng ${escapeHtml(snapshot.code)}</h1>
        ${
          snapshot.isHost
            ? `<button type="button" class="btn btn-primary" data-next>Ván mới</button>`
            : `<span class="status-msg">Chờ chủ phòng mở ván mới…</span>`
        }
        <button type="button" class="btn" data-leave>Rời phòng</button>
      </div>
      <div class="mp-reveal" data-reveal></div>
    `

    const revealEl = table.querySelector<HTMLElement>('[data-reveal]')!
    for (let seat = 0; seat < 4; ++seat) {
      const p = reveal.players.find((x) => x.seat === seat)
      if (!p) continue
      const arr = scored.arrangements[seat]
      const st = scored.seatStatuses[seat]!
      const block = document.createElement('div')
      block.className = 'seat'
      const badge = statusLabelVi(st)
      block.innerHTML = `<div class="seat-label">${escapeHtml(p.name)}${badge ? ` · ${badge}` : ''}</div>`
      const handEl = document.createElement('div')
      handEl.className = 'bot-chis'
      if (st.folded && !arr) {
        handEl.innerHTML = `<div class="fold-badge">Úp bài</div>`
      } else if (arr) {
        for (const row of [
          { tag: 'Trước', cards: arr.front },
          { tag: 'Giữa', cards: arr.middle },
          { tag: 'Sau', cards: arr.back },
        ]) {
          const rowEl = document.createElement('div')
          rowEl.className = 'chi-row'
          const tag = document.createElement('span')
          tag.className = 'chi-tag'
          tag.textContent = row.tag
          rowEl.appendChild(tag)
          for (const card of row.cards) {
            const el = createFaceCard(card, { compact: true })
            el.disabled = true
            rowEl.appendChild(el)
          }
          handEl.appendChild(rowEl)
        }
      }
      block.appendChild(handEl)
      revealEl.appendChild(block)
    }

    const heoNote =
      scored.heoScoopSeat !== null
        ? `· ${names[scored.heoScoopSeat]} hốt ${scored.heoPotBeforePayout}`
        : rules.heoEnabled
          ? '· tích lũy'
          : ''
    scoreboard.renderRound(
      names.map((name, i) => ({
        name,
        chi: scored.chiScores[i]!,
        soAt: scored.soAtScores[i]!,
        atLon: scored.atLonScores[i]!,
        heo: scored.heoScores[i]!,
        total: scored.roundScores[i]!,
        cumulative: totals[i]!,
        statusLabel: statusLabelVi(scored.seatStatuses[i]!),
      })),
      {
        heoPot: rules.heoEnabled ? scored.heoPotAfter : -1,
        heoNote,
      },
    )

    table.querySelector('[data-leave]')!.addEventListener('click', () => {
      void doLeave()
    })

    const nextBtn = table.querySelector<HTMLButtonElement>('[data-next]')
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        void (async () => {
          snapshot = await startRound(session!.roomId, session!.token)
          await render()
        })()
      })
    }
  }

  window.addEventListener('pagehide', () => {
    if (session) {
      leaveBeacon()
      clearSession()
    }
  })

  void render()
  if (session) startPoll()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
