import {
  estimateArrangementPoints,
  optimizeHand,
} from '../ai/optimizer'
import { scoreHeoRound } from '../core/heo'
import { isFoul } from '../core/hand'
import { LEVELS, shouldBotFold, type LevelId } from '../core/levels'
import { scoreRoundChi, type SeatArrangement } from '../core/scoring'
import { detectSpecial } from '../core/special'
import { scoreAtLonhat, scoreSoAt } from '../core/so-at'
import {
  DEFAULT_TABLE_RULES,
  normalizeRules,
  type TableRules,
} from '../core/table-rules'
import type { Arrangement, Card } from '../core/types'

export type PlayRoundInput = {
  level: LevelId
  human: Arrangement | 'fold' | 'claim'
  hands: [Card[], Card[], Card[], Card[]]
  rng?: () => number
  rules?: Partial<TableRules>
  /** Rổ heo trước ván này. */
  heoPotBefore?: number
}

/** Per-seat outcome for UI (Úp bài / Đặc biệt / Binh). */
export type SeatRoundStatus = {
  folded: boolean
  specialKind: number
  foul?: boolean
}

export type PlayRoundResult = {
  chiScores: number[]
  soAtScores: number[]
  atLonScores: number[]
  heoScores: number[]
  roundScores: number[]
  botArrangements: Arrangement[]
  seatStatuses: SeatRoundStatus[]
  heoPotAfter: number
  heoScoopSeat: number | null
  heoPotBeforePayout: number
  rules: TableRules
}

type ResolvedSeat = {
  seat: SeatArrangement
  status: SeatRoundStatus
  arrangement?: Arrangement
}

function chunkHand(hand: Card[]): Arrangement {
  return {
    front: hand.slice(0, 3),
    middle: hand.slice(3, 8),
    back: hand.slice(8, 13),
  }
}

function resolveHuman(
  human: PlayRoundInput['human'],
  hand: Card[],
): ResolvedSeat {
  if (human === 'fold') {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0 },
    }
  }

  if (human === 'claim') {
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

  if (isFoul(human.front, human.middle, human.back)) {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0, foul: true },
    }
  }

  return {
    seat: {
      front: human.front,
      middle: human.middle,
      back: human.back,
    },
    status: { folded: false, specialKind: 0 },
    arrangement: human,
  }
}

function resolveBot(
  hand: Card[],
  level: LevelId,
  rng: () => number,
): ResolvedSeat {
  const levelDef = LEVELS[level]
  const special = detectSpecial(hand)

  if (levelDef.aiClaim && special.kind > 0) {
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

  const arr = optimizeHand(hand, levelDef.aiHandicap, rng)
  const expectedPoints = estimateArrangementPoints(arr)

  if (shouldBotFold(expectedPoints, level)) {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      status: { folded: true, specialKind: 0 },
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

/**
 * Orchestrate one round: bots + human, then chi + optional pots + heo.
 */
export function playRound(input: PlayRoundInput): PlayRoundResult {
  const rng = input.rng ?? Math.random
  const rules = normalizeRules(input.rules ?? DEFAULT_TABLE_RULES)
  const heoPotBefore = input.heoPotBefore ?? 0

  const humanResolved = resolveHuman(input.human, input.hands[0])
  const seats: SeatArrangement[] = [humanResolved.seat]
  const seatStatuses: SeatRoundStatus[] = [humanResolved.status]
  const botArrangements: Arrangement[] = []

  for (let i = 1; i <= 3; ++i) {
    const resolved = resolveBot(input.hands[i]!, input.level, rng)
    seats.push(resolved.seat)
    seatStatuses.push(resolved.status)
    botArrangements.push(resolved.arrangement!)
  }

  const chiScores = scoreRoundChi(seats)
  const soAtScores = scoreSoAt(
    input.hands,
    rules.soAtEnabled ? rules.soAtAnte : 0,
  )
  const atLonScores = scoreAtLonhat(
    input.hands,
    rules.atLonEnabled ? rules.atLonAnte : 0,
  )

  let heoScores = [0, 0, 0, 0]
  let heoPotAfter = heoPotBefore
  let heoScoopSeat: number | null = null
  let heoPotBeforePayout = heoPotBefore

  if (rules.heoEnabled) {
    const heo = scoreHeoRound({
      seats,
      heoAnte: rules.heoAnte,
      heoPotBefore,
      payingSeats: [true, true, true, true],
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
    botArrangements,
    seatStatuses,
    heoPotAfter,
    heoScoopSeat,
    heoPotBeforePayout,
    rules,
  }
}
