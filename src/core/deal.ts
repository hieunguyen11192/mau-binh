import { createDeck } from './cards'
import type { Card } from './types'

/**
 * Shuffle `arr` in place with Fisher–Yates.
 * `rng` must return floats in [0, 1).
 */
function shuffleInPlace(arr: Card[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

/**
 * Deal one full deck into 4 hands of 13.
 * Seat 0 = human, seats 1–3 = bots.
 * Optional `rng` (floats in [0,1)) makes shuffle deterministic for tests.
 */
export function dealHands(
  rng: () => number = Math.random,
): [Card[], Card[], Card[], Card[]] {
  const deck = createDeck()
  shuffleInPlace(deck, rng)
  return [
    deck.slice(0, 13),
    deck.slice(13, 26),
    deck.slice(26, 39),
    deck.slice(39, 52),
  ]
}
