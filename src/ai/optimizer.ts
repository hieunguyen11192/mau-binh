import {
  PATTERN_POINTS,
  compareChi,
  evaluateChi,
  type ChiEval,
  type Pattern,
} from '../core/hand'
import type { Arrangement, Card } from '../core/types'

const Front = 0
const Middle = 1
const Back = 2

const Junk = 0
const Pair = 1
const TwoPairs = 2
const Triple = 3
const Straight = 4
const Flush = 5
const FullHouse = 6
const Quadruple = 7
const StraightFlush = 8
const RoyalFlush = 9

const Queen = 10
const Ace = 12

/** Win% tables ported from macroxue/13-warriors wave_evaluator.js */
const junkValue = [
  [0, 0, 0, 0, 0, 1, 1, 2, 2, 4, 7, 15, 34],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]
const junkValue0 = [
  [0, 20, 20, 21, 21, 22, 23, 24, 26, 30, 34, 42, 0],
  [0, 9, 9, 10, 10, 11, 11, 12, 13, 15, 18, 0, 0],
  [0, 5, 5, 5, 6, 6, 7, 7, 8, 8, 0, 0, 0],
]
const onePairValue = [
  [45, 47, 49, 51, 53, 56, 60, 64, 68, 73, 81, 89, 97],
  [2, 3, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24, 33],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3],
]
const onePairValue0 = [
  [96, 96, 96, 96, 96, 96, 97, 97, 97, 97, 98, 98, 0],
  [86, 86, 86, 86, 86, 87, 87, 88, 89, 89, 90, 0, 91],
  [76, 76, 77, 77, 77, 78, 78, 78, 79, 80, 0, 82, 83],
]
const onePairValue1 = [
  [0, 0, 30, 31, 31, 32, 32, 33, 33, 34, 35, 36, 0],
  [0, 0, 23, 23, 23, 23, 23, 24, 25, 25, 26, 0, 27],
  [0, 0, 17, 17, 18, 18, 18, 19, 19, 20, 0, 21, 22],
]
const twoPairValue = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 37, 37, 39, 41, 43, 46, 49, 54, 58, 62, 64, 64],
  [0, 3, 3, 4, 4, 5, 7, 8, 10, 11, 13, 14, 14],
]
const tripleValue = [
  [99, 99, 99, 99, 99, 100, 100, 100, 100, 100, 100, 100, 100],
  [63, 66, 69, 71, 72, 72, 74, 74, 74, 75, 75, 75, 76],
  [12, 13, 13, 15, 16, 16, 16, 16, 16, 14, 15, 15, 15],
]
const straightValue = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 77, 79, 81, 83, 85, 87, 88, 89, 91, 92],
  [0, 0, 0, 16, 18, 20, 22, 24, 26, 28, 31, 34, 37],
]
const flushValue = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 93, 92, 92, 93, 94, 95, 97, 98],
  [0, 0, 0, 0, 0, 35, 37, 38, 38, 40, 44, 50, 61],
]
const flushValue2 = [
  [0, 0, 0, 0, 53, 54, 55, 56, 57, 59, 62, 65, 0],
  [0, 0, 0, 44, 44, 45, 46, 47, 48, 49, 52, 0, 0],
  [0, 0, 0, 41, 41, 41, 42, 42, 44, 45, 0, 0, 0],
]
const fullValue = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [98, 99, 99, 99, 99, 99, 99, 99, 100, 100, 100, 100, 100],
  [65, 66, 69, 71, 73, 75, 78, 80, 82, 85, 88, 91, 94],
]
const quadrupleValue = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  [94, 94, 95, 95, 95, 96, 97, 97, 97, 97, 98, 98, 98],
]

type Candidate = { score: number; arrangement: Arrangement }

function chiWinPercent(ev: ChiEval, order: number): number {
  const r0 = ev.strength
  const pattern = ev.pattern as Pattern
  switch (pattern) {
    case RoyalFlush:
    case StraightFlush:
      return 100
    case Quadruple:
      return quadrupleValue[order]![r0]!
    case FullHouse:
      return fullValue[order]![r0]!
    case Flush: {
      const r1 = ev.features[1]?.rank ?? 0
      if (order === Back && r0 >= Queen) return flushValue2[Ace - r0]![r1]!
      return flushValue[order]![r0]!
    }
    case Straight:
      return straightValue[order]![r0]!
    case Triple:
      return tripleValue[order]![r0]!
    case TwoPairs:
      return twoPairValue[order]![r0]!
    case Pair: {
      const r1 = ev.features[1]?.rank ?? 0
      if (order === Front && r0 >= Queen) return onePairValue0[Ace - r0]![r1]!
      if (order === Middle && r0 >= Queen) return onePairValue1[Ace - r0]![r1]!
      return onePairValue[order]![r0]!
    }
    case Junk: {
      const r1 = ev.features[1]?.rank ?? 0
      if (order === Front && r0 >= Queen) return junkValue0[Ace - r0]![r1]!
      return junkValue[order]![r0]!
    }
    default:
      return 0
  }
}

/** Expected EV * 100 — same formula as 13-warriors expected_points. */
function expectedScore(
  front: ChiEval,
  middle: ChiEval,
  back: ChiEval,
): number {
  const f = chiWinPercent(front, Front) / 100
  const c = chiWinPercent(middle, Middle) / 100
  const b = chiWinPercent(back, Back) / 100
  const fp = PATTERN_POINTS[Front]![front.pattern]!
  const cp = PATTERN_POINTS[Middle]![middle.pattern]!
  const bp = PATTERN_POINTS[Back]![back.pattern]!
  const win3 = f * c * b * 2 * (fp + cp + bp)
  const win2 =
    f * c * (1 - b) * (fp + cp - bp) +
    f * (1 - c) * b * (fp - cp + bp) +
    (1 - f) * c * b * (-fp + cp + bp)
  const win1 =
    f * (1 - c) * (1 - b) * (fp - cp - bp) +
    (1 - f) * c * (1 - b) * (-fp + cp - bp) +
    (1 - f) * (1 - c) * b * (-fp - cp + bp)
  const win0 = (1 - f) * (1 - c) * (1 - b) * 2 * (-fp - cp - bp)
  return Math.floor(100 * (win3 + win2 + win1 + win0))
}

/**
 * Expected chi points for an arrangement (same units as FOLD_POINTS / shouldBotFold).
 * Divides the ×100 13-warriors expected_points scale back to raw points.
 */
export function estimateArrangementPoints(arr: Arrangement): number {
  const front = evaluateChi(arr.front, 'front')
  const middle = evaluateChi(arr.middle, 'middle')
  const back = evaluateChi(arr.back, 'back')
  return expectedScore(front, middle, back) / 100
}

function pickCards(hand: Card[], indices: number[]): Card[] {
  return indices.map((i) => hand[i]!)
}

function remainingIndices(usedBits: number, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; ++i) {
    if (((usedBits >> i) & 1) === 0) out.push(i)
  }
  return out
}

/**
 * Full C(13,5)×C(8,5) legal search (spirit of 13-warriors HandOptimizer).
 * Skips Junk backs first (with fallback), ranks by expected EV, applies
 * handicap by picking the N-th best unique score (higher = weaker).
 * Optional rng breaks near-ties at the chosen score.
 */
export function optimizeHand(
  hand: Card[],
  handicap: number,
  rng: () => number = Math.random,
): Arrangement {
  if (hand.length !== 13) {
    throw new Error(`optimizeHand expects 13 cards, got ${hand.length}`)
  }

  const sorted = hand.slice().sort((a, b) => a.rank - b.rank)
  let candidates = searchCandidates(sorted, true)
  if (candidates.length === 0) {
    candidates = searchCandidates(sorted, false)
  }
  if (candidates.length === 0) {
    throw new Error('optimizeHand: no legal non-foul arrangement found')
  }

  // Best → worst
  candidates.sort((a, b) => b.score - a.score)

  // Unique scores (keep first = best arrangement per score), like reference
  const unique: Candidate[] = []
  let lastScore: number | null = null
  for (const c of candidates) {
    if (lastScore === c.score) continue
    unique.push(c)
    lastScore = c.score
  }

  const offset = Math.min(Math.max(0, handicap), unique.length - 1)
  const targetScore = unique[offset]!.score
  const ties = candidates.filter((c) => c.score === targetScore)
  const pick = ties[Math.floor(rng() * ties.length) % ties.length]!
  return {
    front: pick.arrangement.front.slice(),
    middle: pick.arrangement.middle.slice(),
    back: pick.arrangement.back.slice(),
  }
}

function searchCandidates(
  hand: Card[],
  skipJunkBack: boolean,
): Candidate[] {
  const out: Candidate[] = []
  const n = 13
  // C(13,5) backs
  for (let b1 = 0; b1 < 9; ++b1) {
    for (let b2 = b1 + 1; b2 < 10; ++b2) {
      for (let b3 = b2 + 1; b3 < 11; ++b3) {
        for (let b4 = b3 + 1; b4 < 12; ++b4) {
          for (let b5 = b4 + 1; b5 < 13; ++b5) {
            const backIdx = [b1, b2, b3, b4, b5]
            const backCards = pickCards(hand, backIdx)
            const backEv = evaluateChi(backCards, 'back')
            if (skipJunkBack && backEv.pattern === Junk) continue

            const backBits =
              (1 << b1) | (1 << b2) | (1 << b3) | (1 << b4) | (1 << b5)

            // C(8,5) middles from remaining
            for (let c1 = 0; c1 < 9; ++c1) {
              if ((backBits >> c1) & 1) continue
              for (let c2 = c1 + 1; c2 < 10; ++c2) {
                if ((backBits >> c2) & 1) continue
                for (let c3 = c2 + 1; c3 < 11; ++c3) {
                  if ((backBits >> c3) & 1) continue
                  for (let c4 = c3 + 1; c4 < 12; ++c4) {
                    if ((backBits >> c4) & 1) continue
                    for (let c5 = c4 + 1; c5 < 13; ++c5) {
                      if ((backBits >> c5) & 1) continue

                      const midIdx = [c1, c2, c3, c4, c5]
                      const midCards = pickCards(hand, midIdx)
                      const midEv = evaluateChi(midCards, 'middle')
                      // back must be >= middle
                      if (compareChi(backEv, midEv) < 0) continue

                      const midBits =
                        (1 << c1) |
                        (1 << c2) |
                        (1 << c3) |
                        (1 << c4) |
                        (1 << c5)
                      const used = backBits | midBits
                      const frontIdx = remainingIndices(used, n)
                      const frontCards = pickCards(hand, frontIdx)
                      const frontEv = evaluateChi(frontCards, 'front')
                      // middle must be >= front
                      if (compareChi(midEv, frontEv) < 0) continue

                      out.push({
                        score: expectedScore(frontEv, midEv, backEv),
                        arrangement: {
                          front: frontCards,
                          middle: midCards,
                          back: backCards,
                        },
                      })
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return out
}
