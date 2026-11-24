import { describe, expect, it } from 'vitest'
import {
  compareAceStrength,
  createDeck,
  suitStrength,
} from '../../src/core/cards'
import type { Card } from '../../src/core/types'

describe('cards', () => {
  it('createDeck has 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)

    const keys = deck.map((c) => `${c.rank}-${c.suit}`)
    expect(new Set(keys).size).toBe(52)

    for (let rank = 0; rank <= 12; rank++) {
      for (let suit = 0; suit <= 3; suit++) {
        expect(deck.some((c) => c.rank === rank && c.suit === suit)).toBe(true)
      }
    }
  })

  it('Hearts outranks Diamonds for Ace suit strength', () => {
    expect(suitStrength(3)).toBeGreaterThan(suitStrength(2))

    const aceHearts: Card = { rank: 12, suit: 3 }
    const aceDiamonds: Card = { rank: 12, suit: 2 }
    expect(compareAceStrength(aceHearts, aceDiamonds)).toBeGreaterThan(0)
    expect(compareAceStrength(aceDiamonds, aceHearts)).toBeLessThan(0)
  })
})
