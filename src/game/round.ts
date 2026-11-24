import {
  estimateArrangementPoints,
  optimizeHand,
} from '../ai/optimizer'
import { isFoul } from '../core/hand'
import { LEVELS, shouldBotFold, type LevelId } from '../core/levels'
import { scoreRoundChi, type SeatArrangement } from '../core/scoring'
import { detectSpecial } from '../core/special'
import { scoreSoAt } from '../core/so-at'
import type { Arrangement, Card } from '../core/types'

export type PlayRoundInput = {
  level: LevelId
  human: Arrangement | 'fold' | 'claim'
  hands: [Card[], Card[], Card[], Card[]]
  rng?: () => number
}

export type PlayRoundResult = {
  chiScores: number[]
  soAtScores: number[]
  roundScores: number[]
  botArrangements: Arrangement[]
}

/** Placeholder 3+5+5 split when special has no arranged layout (Dragon / SixPairs). */
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
): SeatArrangement {
  if (human === 'fold') {
    return { front: [], middle: [], back: [], folded: true }
  }

  if (human === 'claim') {
    const special = detectSpecial(hand)
    if (special.kind > 0) {
      const arr = special.arranged ?? chunkHand(hand)
      return {
        front: arr.front,
        middle: arr.middle,
        back: arr.back,
        specialKind: special.kind,
      }
    }
    // Invalid claim (no special) → fold for chi
    return { front: [], middle: [], back: [], folded: true }
  }

  if (isFoul(human.front, human.middle, human.back)) {
    return { front: [], middle: [], back: [], folded: true }
  }

  return {
    front: human.front,
    middle: human.middle,
    back: human.back,
  }
}

function resolveBot(
  hand: Card[],
  level: LevelId,
  rng: () => number,
): { seat: SeatArrangement; arrangement: Arrangement } {
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
      arrangement: arr,
    }
  }

  const arr = optimizeHand(hand, levelDef.aiHandicap, rng)
  const expectedPoints = estimateArrangementPoints(arr)

  if (shouldBotFold(expectedPoints, level)) {
    return {
      seat: { front: [], middle: [], back: [], folded: true },
      arrangement: arr,
    }
  }

  return {
    seat: {
      front: arr.front,
      middle: arr.middle,
      back: arr.back,
    },
    arrangement: arr,
  }
}

/**
 * Orchestrate one round: bots arrange (handicap / claim / fold), human action,
 * then chi + So Át. So Át always uses full dealt hands (folded seats included).
 */
export function playRound(input: PlayRoundInput): PlayRoundResult {
  const rng = input.rng ?? Math.random
  const seats: SeatArrangement[] = [
    resolveHuman(input.human, input.hands[0]),
  ]
  const botArrangements: Arrangement[] = []

  for (let i = 1; i <= 3; ++i) {
    const { seat, arrangement } = resolveBot(
      input.hands[i]!,
      input.level,
      rng,
    )
    seats.push(seat)
    botArrangements.push(arrangement)
  }

  const chiScores = scoreRoundChi(seats)
  const soAtScores = scoreSoAt(input.hands)
  const roundScores = chiScores.map((c, i) => c + soAtScores[i]!)

  return { chiScores, soAtScores, roundScores, botArrangements }
}
