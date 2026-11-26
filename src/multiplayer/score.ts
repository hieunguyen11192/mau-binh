import { scoreHeoRound } from '../core/heo'
import { isFoul } from '../core/hand'
import { scoreRoundChi, type SeatArrangement } from '../core/scoring'
import { detectSpecial } from '../core/special'
import { scoreAtLonhat, scoreSoAt } from '../core/so-at'
import {
  DEFAULT_TABLE_RULES,
  normalizeRules,
  type TableRules,
} from '../core/table-rules'
import type { Arrangement, Card } from '../core/types'
import type { SeatRoundStatus } from '../game/round'
import type { MpSubmission } from './types'

function chunkHand(hand: Card[]): Arrangement {
  return {
    front: hand.slice(0, 3),
    middle: hand.slice(3, 8),
    back: hand.slice(8, 13),
  }
}

function resolvePlay(
  hand: Card[],
  sub: MpSubmission | undefined,
  occupied: boolean,
): { seat: SeatArrangement; status: SeatRoundStatus; arrangement?: Arrangement } {
  // Empty chair — not in the game (inactive for chi + pots)
  if (!occupied) {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0 },
    }
  }

  if (!sub || sub.action === 'fold') {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0 },
    }
  }

  if (sub.action === 'claim') {
    const special = detectSpecial(hand)
    if (special.kind > 0) {
      const arr = special.arranged ?? chunkHand(hand)
      return {
        seat: {
          front: arr.front,
          middle: arr.middle,
          back: arr.back,
          specialKind: special.kind,
        },
        status: { folded: false, specialKind: special.kind },
        arrangement: arr,
      }
    }
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0 },
    }
  }

  const arr = sub.arrangement
  if (!arr) {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0 },
    }
  }

  if (isFoul(arr.front, arr.middle, arr.back)) {
    return {
      seat: {
        front: arr.front,
        middle: arr.middle,
        back: arr.back,
        folded: true,
      },
      status: { folded: true, specialKind: 0, foul: true },
      arrangement: arr,
    }
  }

  return {
    seat: {
      front: arr.front,
      middle: arr.middle,
      back: arr.back,
    },
    status: { folded: false, specialKind: 0 },
    arrangement: arr,
  }
}

export type MpScoreResult = {
  chiScores: number[]
  soAtScores: number[]
  atLonScores: number[]
  heoScores: number[]
  roundScores: number[]
  seatStatuses: SeatRoundStatus[]
  arrangements: (Arrangement | null)[]
  heoPotAfter: number
  heoScoopSeat: number | null
  heoPotBeforePayout: number
}

export function scoreMultiplayerReveal(
  handsBySeat: Record<string, Card[]>,
  submissions: MpSubmission[],
  opts?: {
    rules?: Partial<TableRules>
    heoPotBefore?: number
    /** Which seats are occupied. Default: hand length 13. */
    occupied?: boolean[]
  },
): MpScoreResult {
  const rules = normalizeRules(opts?.rules ?? DEFAULT_TABLE_RULES)
  const heoPotBefore = opts?.heoPotBefore ?? 0
  const bySeat = new Map(submissions.map((s) => [s.seat, s]))
  const seats: SeatArrangement[] = []
  const seatStatuses: SeatRoundStatus[] = []
  const arrangements: (Arrangement | null)[] = []
  const hands: Card[][] = []
  const occupied =
    opts?.occupied ??
    [0, 1, 2, 3].map((i) => (handsBySeat[String(i)]?.length ?? 0) === 13)

  for (let i = 0; i < 4; ++i) {
    const hand = handsBySeat[String(i)] ?? []
    hands.push(hand)
    const resolved = resolvePlay(hand, bySeat.get(i), occupied[i]!)
    seats.push(resolved.seat)
    seatStatuses.push(resolved.status)
    arrangements.push(resolved.arrangement ?? null)
  }

  const chiScores = scoreRoundChi(seats)

  // So Át / Át to: chỉ ghế có người
  const activeIdx = [0, 1, 2, 3].filter((i) => occupied[i])
  const activeHands = activeIdx.map((i) => hands[i]!)
  const soAtActive = scoreSoAt(
    activeHands,
    rules.soAtEnabled ? rules.soAtAnte : 0,
  )
  const atLonActive = scoreAtLonhat(
    activeHands,
    rules.atLonEnabled ? rules.atLonAnte : 0,
  )
  const soAtScores = [0, 0, 0, 0]
  const atLonScores = [0, 0, 0, 0]
  activeIdx.forEach((seat, k) => {
    soAtScores[seat] = soAtActive[k]!
    atLonScores[seat] = atLonActive[k]!
  })

  let heoScores = [0, 0, 0, 0]
  let heoPotAfter = heoPotBefore
  let heoScoopSeat: number | null = null
  let heoPotBeforePayout = heoPotBefore

  if (rules.heoEnabled) {
    const heo = scoreHeoRound({
      seats,
      heoAnte: rules.heoAnte,
      heoPotBefore,
      payingSeats: occupied,
    })
    heoScores = heo.heoScores
    heoPotAfter = heo.heoPotAfter
    heoScoopSeat = heo.scoopSeat
    heoPotBeforePayout = heo.heoPotBeforePayout
  }

  const roundScores = chiScores.map(
    (c, i) =>
      c + soAtScores[i]! + atLonScores[i]! + heoScores[i]!,
  )

  return {
    chiScores,
    soAtScores,
    atLonScores,
    heoScores,
    roundScores,
    seatStatuses,
    arrangements,
    heoPotAfter,
    heoScoopSeat,
    heoPotBeforePayout,
  }
}
