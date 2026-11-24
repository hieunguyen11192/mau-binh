import { describe, expect, it } from 'vitest'
import { SPECIAL_POINTS, detectSpecial } from '../../src/core/special'
import type { Card } from '../../src/core/types'

/** Rank: Two=0 … Ace=12; Suit: 0=♠ 1=♣ 2=♦ 3=♥ */
const c = (rank: number, suit: number): Card => ({
  rank: rank as Card['rank'],
  suit: suit as Card['suit'],
})

describe('special patterns', () => {
  it('SPECIAL_POINTS matches 13-warriors table', () => {
    expect(SPECIAL_POINTS).toEqual([0, 6, 6, 6, 13])
  })

  it('13-card straight is Dragon with 13 points', () => {
    // One of each rank 0..12, mixed suits
    const hand: Card[] = [
      c(0, 0),
      c(1, 1),
      c(2, 2),
      c(3, 3),
      c(4, 0),
      c(5, 1),
      c(6, 2),
      c(7, 3),
      c(8, 0),
      c(9, 1),
      c(10, 2),
      c(11, 3),
      c(12, 0),
    ]
    const result = detectSpecial(hand)
    expect(result.kind).toBe(4) // Dragon
    expect(result.points).toBe(13)
  })

  it('six pairs is SixPairs with 6 points', () => {
    // Six distinct pairs + one singleton
    const hand: Card[] = [
      c(0, 0),
      c(0, 1),
      c(2, 0),
      c(2, 1),
      c(4, 0),
      c(4, 1),
      c(6, 0),
      c(6, 1),
      c(8, 0),
      c(8, 1),
      c(10, 0),
      c(10, 1),
      c(12, 0), // singleton Ace
    ]
    const result = detectSpecial(hand)
    expect(result.kind).toBe(3) // SixPairs
    expect(result.points).toBe(6)
  })

  it('no special returns kind 0 and 0 points', () => {
    const hand: Card[] = [
      c(0, 0),
      c(0, 1),
      c(1, 0),
      c(3, 1),
      c(5, 2),
      c(5, 3),
      c(7, 0),
      c(8, 1),
      c(9, 2),
      c(10, 0),
      c(11, 1),
      c(11, 2),
      c(12, 3),
    ]
    const result = detectSpecial(hand)
    expect(result.kind).toBe(0) // None
    expect(result.points).toBe(0)
  })
})
