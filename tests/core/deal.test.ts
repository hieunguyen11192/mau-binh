import { describe, expect, it } from 'vitest'
import { dealHands } from '../../src/core/deal'
import type { Card } from '../../src/core/types'

function cardKey(c: Card): string {
  return `${c.rank}-${c.suit}`
}

/** Deterministic rng: returns successive values from a fixed sequence (mod length). */
function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    // LCG — enough for Fisher–Yates determinism tests
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

describe('dealHands', () => {
  it('deals 4 hands of 13 cards each', () => {
    const hands = dealHands()
    expect(hands).toHaveLength(4)
    for (const hand of hands) {
      expect(hand).toHaveLength(13)
    }
  })

  it('union of hands is 52 unique cards (full deck partition)', () => {
    const hands = dealHands()
    const all = hands.flat()
    expect(all).toHaveLength(52)
    const keys = all.map(cardKey)
    expect(new Set(keys).size).toBe(52)
  })

  it('is deterministic with the same seeded rng', () => {
    const a = dealHands(seededRng(42))
    const b = dealHands(seededRng(42))
    expect(a.map((h) => h.map(cardKey))).toEqual(b.map((h) => h.map(cardKey)))
  })

  it('different seeds produce different deals', () => {
    const a = dealHands(seededRng(1))
    const b = dealHands(seededRng(2))
    expect(a.map((h) => h.map(cardKey))).not.toEqual(b.map((h) => h.map(cardKey)))
  })
})
