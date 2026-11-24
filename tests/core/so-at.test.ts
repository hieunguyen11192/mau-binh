import { describe, expect, it } from 'vitest'
import {
  AT_LON_ANTE,
  SO_AT_ANTE,
  SO_AT_POINTS,
  scoreAtLonhat,
  scoreSoAt,
} from '../../src/core/so-at'
import type { Card } from '../../src/core/types'

/** Rank: Two=0 … Ace=12; Suit: 0=♠ 1=♣ 2=♦ 3=♥ */
const c = (rank: number, suit: number): Card => ({
  rank: rank as Card['rank'],
  suit: suit as Card['suit'],
})

/** Build a 13-card hand from notable cards; pad with non-Ace/non-Two fillers. */
function hand(...notable: Card[]): Card[] {
  const cards = [...notable]
  for (let rank = 1; rank <= 11 && cards.length < 13; rank++) {
    for (let suit = 0; suit <= 3 && cards.length < 13; suit++) {
      if (cards.some((x) => x.rank === rank && x.suit === suit)) continue
      cards.push(c(rank, suit))
    }
  }
  return cards
}

/** Net = pot payout − ante */
function nets(payouts: number[]): number[] {
  return payouts.map((p) => p - SO_AT_ANTE)
}

describe('so-at pot', () => {
  it('exports SO_AT_POINTS as 30/20/10/0 and ante 15', () => {
    expect(SO_AT_POINTS).toEqual([30, 20, 10, 0])
    expect(SO_AT_ANTE).toBe(15)
  })

  it('unique Ace counts → nets +15/+5/−5/−15', () => {
    const hands = [
      hand(c(12, 0), c(12, 1), c(12, 2)), // 3 Aces → Nhất 30
      hand(c(12, 3), c(12, 0)), // 2 Aces → Nhì 20
      hand(c(12, 1)), // 1 Ace → Ba 10
      hand(), // 0 Aces → Bét 0
    ]
    expect(scoreSoAt(hands)).toEqual(nets([30, 20, 10, 0]))
    expect(scoreSoAt(hands).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('two players with 1 Ace: Hearts Ace beats Spades Ace', () => {
    const hands = [
      hand(c(12, 3)), // Ace♥ → 30
      hand(c(12, 0)), // Ace♠ → 20
      hand(), // split Ba+Bét → 5 each
      hand(),
    ]
    expect(scoreSoAt(hands)).toEqual(nets([30, 20, 5, 5]))
  })

  it('top two with 2 Aces each; bottom two 0 Aces ranked by Hai', () => {
    const hands = [
      hand(c(12, 3), c(12, 2)),
      hand(c(12, 1), c(12, 0)),
      hand(c(0, 3), c(0, 2)),
      hand(c(0, 0)),
    ]
    expect(scoreSoAt(hands)).toEqual(nets([30, 20, 10, 0]))
  })

  it('four-way identical → each payout 15, net 0', () => {
    const hands = [hand(), hand(), hand(), hand()]
    expect(scoreSoAt(hands)).toEqual([0, 0, 0, 0])
  })
})

describe('at-lonhat pot', () => {
  it('exports AT_LON_ANTE = 5', () => {
    expect(AT_LON_ANTE).toBe(5)
  })

  it('strongest Ace takes pot 20 → nets +15 / −5 / −5 / −5', () => {
    const hands = [
      hand(c(12, 0)), // Ace♠
      hand(c(12, 3)), // Ace♥ → to nhất
      hand(c(12, 1)), // Ace♣
      hand(), // no Ace
    ]
    expect(scoreAtLonhat(hands)).toEqual([-5, 15, -5, -5])
    expect(scoreAtLonhat(hands).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('no Aces → pot split, each net 0', () => {
    const hands = [hand(), hand(), hand(), hand()]
    expect(scoreAtLonhat(hands)).toEqual([0, 0, 0, 0])
  })
})
