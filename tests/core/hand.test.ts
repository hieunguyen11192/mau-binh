import { describe, expect, it } from 'vitest'
import {
  PATTERN_POINTS,
  compareChi,
  evaluateChi,
  isFoul,
} from '../../src/core/hand'
import type { Card } from '../../src/core/types'

/** Rank: Two=0 … Ace=12; Suit: 0=♠ 1=♣ 2=♦ 3=♥ */
const c = (rank: number, suit: number): Card => ({
  rank: rank as Card['rank'],
  suit: suit as Card['suit'],
})

describe('hand evaluation', () => {
  it('pair of kings front beats junk', () => {
    const pairKings: Card[] = [c(11, 0), c(11, 1), c(5, 2)]
    const junk: Card[] = [c(12, 0), c(10, 1), c(8, 2)]

    const a = evaluateChi(pairKings, 'front')
    const b = evaluateChi(junk, 'front')

    expect(a.pattern).toBe(1) // Pair
    expect(b.pattern).toBe(0) // Junk
    expect(compareChi(a, b)).toBeGreaterThan(0)
  })

  it('foul when middle < front', () => {
    const front: Card[] = [c(12, 0), c(12, 1), c(12, 2)] // triple aces
    const middle: Card[] = [c(3, 0), c(5, 1), c(7, 2), c(9, 0), c(11, 1)] // junk
    const back: Card[] = [c(2, 0), c(4, 1), c(6, 2), c(8, 0), c(10, 1)] // junk weaker

    expect(isFoul(front, middle, back)).toBe(true)
  })

  it('triple front awards pattern index Triple', () => {
    const triple: Card[] = [c(7, 0), c(7, 1), c(7, 2)]
    const result = evaluateChi(triple, 'front')
    expect(result.pattern).toBe(3) // Triple
  })

  it('PATTERN_POINTS matches 13-warriors table', () => {
    expect(PATTERN_POINTS).toEqual([
      [1, 1, 1, 3, 1, 1, 1, 1, 1, 1], // front
      [1, 1, 1, 1, 1, 1, 2, 8, 10, 20], // middle
      [1, 1, 1, 1, 1, 1, 1, 4, 5, 10], // back
    ])
  })

  it('is not foul when back >= middle >= front', () => {
    const front: Card[] = [c(5, 0), c(8, 1), c(10, 2)] // junk
    const middle: Card[] = [c(11, 0), c(11, 1), c(2, 2), c(4, 0), c(6, 1)] // pair kings
    const back: Card[] = [c(12, 0), c(12, 1), c(12, 2), c(3, 0), c(9, 1)] // triple aces

    expect(isFoul(front, middle, back)).toBe(false)
  })

  it('foul: Ace-high junk front vs low junk middle (feature-wise, not length)', () => {
    const front: Card[] = [c(12, 0), c(11, 1), c(10, 2)] // A,K,Q
    const middle: Card[] = [c(5, 0), c(3, 1), c(2, 2), c(1, 0), c(0, 1)] // 7,5,4,3,2
    const back: Card[] = [c(12, 1), c(12, 2), c(4, 0), c(6, 1), c(8, 2)] // pair aces

    expect(isFoul(front, middle, back)).toBe(true)
  })

  it('foul: pair Aces front vs pair Twos middle', () => {
    const front: Card[] = [c(12, 0), c(12, 1), c(5, 2)]
    const middle: Card[] = [c(0, 0), c(0, 1), c(3, 2), c(5, 0), c(7, 1)]
    const back: Card[] = [c(11, 0), c(11, 1), c(11, 2), c(2, 0), c(4, 1)] // triple kings

    expect(isFoul(front, middle, back)).toBe(true)
  })

  it('not foul when equal high-card prefix (stops at min length)', () => {
    const front: Card[] = [c(12, 0), c(11, 1), c(10, 2)] // A,K,Q
    const middle: Card[] = [c(12, 1), c(11, 2), c(10, 0), c(3, 1), c(0, 2)] // A,K,Q,5,2
    const back: Card[] = [c(9, 0), c(9, 1), c(2, 2), c(4, 0), c(6, 1)] // pair jacks > junk

    expect(isFoul(front, middle, back)).toBe(false)
  })
})