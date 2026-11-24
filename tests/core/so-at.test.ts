import { describe, expect, it } from 'vitest'
import { SO_AT_POINTS, scoreSoAt } from '../../src/core/so-at'
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

describe('so-at', () => {
  it('exports SO_AT_POINTS as 30/20/10/0', () => {
    expect(SO_AT_POINTS).toEqual([30, 20, 10, 0])
  })

  it('unique Ace counts → 30/20/10/0 by count', () => {
    const hands = [
      hand(c(12, 0), c(12, 1), c(12, 2)), // 3 Aces → Nhất
      hand(c(12, 3), c(12, 0)), // 2 Aces → Nhì (suits may overlap seats in unit tests)
      hand(c(12, 1)), // 1 Ace → Ba
      hand(), // 0 Aces → Bét
    ]
    expect(scoreSoAt(hands)).toEqual([30, 20, 10, 0])
  })

  it('two players with 1 Ace: Hearts Ace beats Spades Ace', () => {
    const hands = [
      hand(c(12, 3)), // Ace♥
      hand(c(12, 0)), // Ace♠
      hand(), // 0
      hand(), // 0 — split Ba+Bét
    ]
    expect(scoreSoAt(hands)).toEqual([30, 20, 5, 5])
  })

  it('top two with 2 Aces each; bottom two 0 Aces ranked by Hai', () => {
    const hands = [
      hand(c(12, 3), c(12, 2)), // 2 Aces, strongest ♥ → Nhất
      hand(c(12, 1), c(12, 0)), // 2 Aces, strongest ♣ → Nhì
      hand(c(0, 3), c(0, 2)), // 0 Aces, 2 Twos → Ba
      hand(c(0, 0)), // 0 Aces, 1 Two → Bét
    ]
    expect(scoreSoAt(hands)).toEqual([30, 20, 10, 0])
  })

  it('four-way identical → each gets 15 (60/4)', () => {
    // All 0 Aces, 0 Twos → fully identical residual tie
    const hands = [hand(), hand(), hand(), hand()]
    expect(scoreSoAt(hands)).toEqual([15, 15, 15, 15])
  })
})
