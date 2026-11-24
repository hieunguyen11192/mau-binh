import {
  PATTERN_POINTS,
  compareChi,
  evaluateChi,
  isFoul,
  type Chi,
} from './hand'
import { SPECIAL_POINTS, type SpecialKind } from './special'
import type { Card } from './types'

export type SeatArrangement = {
  front: Card[]
  middle: Card[]
  back: Card[]
  folded?: boolean
  specialKind?: SpecialKind
}

type SeatStatus = 'inactive' | 'special' | 'normal'

const CHIS: Chi[] = ['front', 'middle', 'back']

function classify(seat: SeatArrangement): SeatStatus {
  if (seat.folded) return 'inactive'
  const kind = seat.specialKind ?? 0
  if (kind > 0) return 'special'
  if (isFoul(seat.front, seat.middle, seat.back)) return 'inactive'
  return 'normal'
}

function applyNormalChiPair(
  scores: number[],
  i: number,
  j: number,
  a: SeatArrangement,
  b: SeatArrangement,
): void {
  let iPoints = 0
  let jPoints = 0
  let iWins = 0
  let jWins = 0

  for (let w = 0; w < CHIS.length; ++w) {
    const chi = CHIS[w]
    const evalA = evaluateChi(a[chi], chi)
    const evalB = evaluateChi(b[chi], chi)
    const cmp = compareChi(evalA, evalB)
    if (cmp > 0) {
      iPoints += PATTERN_POINTS[w][evalA.pattern]
      ++iWins
    } else if (cmp < 0) {
      jPoints += PATTERN_POINTS[w][evalB.pattern]
      ++jWins
    }
  }

  if (iWins === 3) iPoints *= 2
  if (jWins === 3) jPoints *= 2

  scores[i] += iPoints - jPoints
  scores[j] += jPoints - iPoints
}

/**
 * Pairwise chi scoring for four seats.
 * Folded / foul → chiScore 0, skipped in pairs.
 * Special seats skip normal chis; settle via SPECIAL_POINTS.
 */
export function scoreRoundChi(seats: SeatArrangement[]): number[] {
  const scores = [0, 0, 0, 0]
  const statuses = seats.map(classify)
  const kinds = seats.map((s) => (s.specialKind ?? 0) as SpecialKind)

  for (let i = 0; i < 4; ++i) {
    if (statuses[i] === 'inactive') continue
    for (let j = i + 1; j < 4; ++j) {
      if (statuses[j] === 'inactive') continue

      const si = statuses[i]
      const sj = statuses[j]

      if (si === 'special' && sj === 'special') {
        // Kind order: Dragon > SixPairs > ThreeFlushes > ThreeStraights
        if (kinds[i] === kinds[j]) continue
        const winner = kinds[i] > kinds[j] ? i : j
        const loser = winner === i ? j : i
        const diff =
          SPECIAL_POINTS[kinds[winner]] - SPECIAL_POINTS[kinds[loser]]
        scores[winner] += diff
        scores[loser] -= diff
      } else if (si === 'special' && sj === 'normal') {
        const p = SPECIAL_POINTS[kinds[i]]
        scores[i] += p
        scores[j] -= p
      } else if (sj === 'special' && si === 'normal') {
        const p = SPECIAL_POINTS[kinds[j]]
        scores[j] += p
        scores[i] -= p
      } else {
        applyNormalChiPair(scores, i, j, seats[i], seats[j])
      }
    }
  }

  return scores
}
