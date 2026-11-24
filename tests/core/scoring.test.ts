import { describe, expect, it } from 'vitest'
import { PATTERN_POINTS } from '../../src/core/hand'
import { SPECIAL_POINTS } from '../../src/core/special'
import { scoreRoundChi } from '../../src/core/scoring'
import type { SeatArrangement } from '../../src/core/scoring'
import type { Card } from '../../src/core/types'

/** Rank: Two=0 … Ace=12; Suit: 0=♠ 1=♣ 2=♦ 3=♥ */
const c = (rank: number, suit: number): Card => ({
  rank: rank as Card['rank'],
  suit: suit as Card['suit'],
})

/** Seat0 stronger back (pair Aces) vs seat1 (pair Kings); front/middle tie. */
function backPairDuel(): [SeatArrangement, SeatArrangement] {
  const a: SeatArrangement = {
    front: [c(0, 0), c(1, 1), c(2, 2)], // 2,3,4 junk
    middle: [c(3, 0), c(3, 1), c(4, 2), c(5, 0), c(6, 1)], // pair 5s
    back: [c(12, 0), c(12, 1), c(7, 2), c(8, 0), c(9, 1)], // pair Aces
  }
  const b: SeatArrangement = {
    front: [c(0, 1), c(1, 2), c(2, 0)], // 2,3,4 junk (tie)
    middle: [c(3, 2), c(3, 3), c(4, 0), c(5, 1), c(6, 2)], // pair 5s (tie)
    back: [c(11, 0), c(11, 1), c(7, 0), c(8, 1), c(9, 2)], // pair Kings
  }
  return [a, b]
}

/** Seat0 scoops all 3 chis vs seat1. */
function scoopDuel(): [SeatArrangement, SeatArrangement] {
  const a: SeatArrangement = {
    front: [c(11, 0), c(11, 1), c(0, 2)], // pair Kings
    middle: [c(12, 0), c(12, 1), c(12, 2), c(1, 0), c(2, 1)], // triple Aces
    back: [c(10, 0), c(10, 1), c(10, 2), c(9, 0), c(9, 1)], // full house Q/J
  }
  const b: SeatArrangement = {
    front: [c(3, 0), c(4, 1), c(5, 2)], // junk
    middle: [c(6, 0), c(6, 1), c(0, 0), c(1, 1), c(2, 2)], // pair 8s
    back: [c(8, 0), c(8, 1), c(3, 1), c(4, 2), c(5, 0)], // pair 10s
  }
  return [a, b]
}

function foldedPad(): SeatArrangement {
  return {
    front: [],
    middle: [],
    back: [],
    folded: true,
  }
}

describe('scoreRoundChi', () => {
  it('stronger back pair transfers back pattern points (two active seats)', () => {
    const [a, b] = backPairDuel()
    const seats: SeatArrangement[] = [a, b, foldedPad(), foldedPad()]
    const scores = scoreRoundChi(seats)

    const backPairPts = PATTERN_POINTS[2][1] // back / Pair = 1
    expect(scores).toEqual([backPairPts, -backPairPts, 0, 0])
  })

  it('scoop (win all 3 chis) doubles that pair’s chi points', () => {
    const [a, b] = scoopDuel()
    const seats: SeatArrangement[] = [a, b, foldedPad(), foldedPad()]
    const scores = scoreRoundChi(seats)

    // front Pair=1 + middle Triple=1 + back FullHouse=1 = 3, ×2 scoop = 6
    const raw =
      PATTERN_POINTS[0][1] + PATTERN_POINTS[1][3] + PATTERN_POINTS[2][6]
    expect(raw).toBe(3)
    expect(scores).toEqual([raw * 2, -raw * 2, 0, 0])
  })

  it('folded seat stays at chiScore 0 while others score', () => {
    const [a, b] = backPairDuel()
    const seats: SeatArrangement[] = [a, foldedPad(), b, foldedPad()]
    const scores = scoreRoundChi(seats)

    const backPairPts = PATTERN_POINTS[2][1]
    expect(scores[1]).toBe(0)
    expect(scores[3]).toBe(0)
    expect(scores[0]).toBe(backPairPts)
    expect(scores[2]).toBe(-backPairPts)
    // Note (Task 6): folded seat still later gets So Át from dealt hand;
    // scoreRoundChi only covers chi — So Át is additive outside this function.
  })

  it('special claimant collects SPECIAL_POINTS from each other non-folded seat', () => {
    const [, normal] = backPairDuel()
    const seats: SeatArrangement[] = [
      {
        front: [c(0, 0), c(1, 0), c(2, 0)],
        middle: [c(3, 0), c(4, 0), c(5, 0), c(6, 0), c(7, 0)],
        back: [c(8, 0), c(9, 0), c(10, 0), c(11, 0), c(12, 0)],
        specialKind: 4, // Dragon
      },
      normal,
      foldedPad(),
      foldedPad(),
    ]
    const scores = scoreRoundChi(seats)
    const p = SPECIAL_POINTS[4]
    expect(p).toBe(13)
    expect(scores).toEqual([p, -p, 0, 0])
  })

  it('two specials: Dragon > SixPairs; loser pays SPECIAL_POINTS difference', () => {
    // Ruling: kind order Dragon(4) > SixPairs(3) > ThreeFlushes(2) > ThreeStraights(1).
    // Settlement = |SPECIAL_POINTS[winner] - SPECIAL_POINTS[loser]| (here 13 − 6 = 7).
    const seats: SeatArrangement[] = [
      {
        front: [c(0, 0), c(1, 0), c(2, 0)],
        middle: [c(3, 0), c(4, 0), c(5, 0), c(6, 0), c(7, 0)],
        back: [c(8, 0), c(9, 0), c(10, 0), c(11, 0), c(12, 0)],
        specialKind: 4, // Dragon
      },
      {
        front: [c(0, 1), c(0, 2), c(2, 1)],
        middle: [c(2, 2), c(4, 1), c(4, 2), c(6, 1), c(6, 2)],
        back: [c(8, 1), c(8, 2), c(10, 1), c(10, 2), c(12, 1)],
        specialKind: 3, // SixPairs
      },
      foldedPad(),
      foldedPad(),
    ]
    const scores = scoreRoundChi(seats)
    const diff = SPECIAL_POINTS[4] - SPECIAL_POINTS[3]
    expect(diff).toBe(7)
    expect(scores).toEqual([diff, -diff, 0, 0])
  })

  it('foul seat: chiScore 0 and skipped in pairwise (like fold)', () => {
    // Ruling (brief silent → progress): foul excluded like fold; foul score = 0.
    // Non-foul seats still pairwise among themselves.
    const foul: SeatArrangement = {
      front: [c(12, 0), c(12, 1), c(12, 2)], // triple Aces
      middle: [c(3, 0), c(5, 1), c(7, 2), c(9, 0), c(11, 1)], // junk — foul
      back: [c(2, 0), c(4, 1), c(6, 2), c(8, 0), c(10, 1)],
    }
    const [a, b] = backPairDuel()
    const seats: SeatArrangement[] = [foul, a, b, foldedPad()]
    const scores = scoreRoundChi(seats)

    const backPairPts = PATTERN_POINTS[2][1]
    expect(scores[0]).toBe(0) // foul
    expect(scores[3]).toBe(0) // folded
    expect(scores[1]).toBe(backPairPts)
    expect(scores[2]).toBe(-backPairPts)
  })
})
