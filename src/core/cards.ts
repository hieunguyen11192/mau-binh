import type { Card, Rank, Suit } from './types'

/** Hearts (3) highest — suit value itself is the strength */
export function suitStrength(s: Suit): number {
  return s
}

/** Compare Ace/Two suit strength: positive if a > b */
export function compareAceStrength(a: Card, b: Card): number {
  return suitStrength(a.suit) - suitStrength(b.suit)
}

/** Full 52-card deck: every rank × suit once */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (let rank = 0; rank <= 12; rank++) {
    for (let suit = 0; suit <= 3; suit++) {
      deck.push({ rank: rank as Rank, suit: suit as Suit })
    }
  }
  return deck
}
