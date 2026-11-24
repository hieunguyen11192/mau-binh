import { describe, expect, it } from 'vitest'
import { optimizeHand } from '../../src/ai/optimizer'
import { dealHands } from '../../src/core/deal'
import { isFoul } from '../../src/core/hand'
import type { Card } from '../../src/core/types'

/** Deterministic mulberry32 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function assertArrangement(hand: Card[], arr: ReturnType<typeof optimizeHand>) {
  expect(arr.front).toHaveLength(3)
  expect(arr.middle).toHaveLength(5)
  expect(arr.back).toHaveLength(5)
  expect(isFoul(arr.front, arr.middle, arr.back)).toBe(false)

  const used = [...arr.front, ...arr.middle, ...arr.back]
  expect(used).toHaveLength(13)
  const key = (c: Card) => `${c.rank}-${c.suit}`
  const handKeys = hand.map(key).sort()
  const usedKeys = used.map(key).sort()
  expect(usedKeys).toEqual(handKeys)
}

describe('optimizeHand', () => {
  it('returns 3+5+5 non-foul for N=20 random hands (handicap 0)', () => {
    for (let i = 0; i < 20; i++) {
      const rng = mulberry32(1000 + i)
      const [hand] = dealHands(rng)
      const arr = optimizeHand(hand, 0)
      assertArrangement(hand, arr)
    }
  })

  it('higher handicap does not crash and stays legal', () => {
    const rng = mulberry32(42)
    const [hand] = dealHands(rng)
    for (const handicap of [0, 2, 4, 6, 20]) {
      const arr = optimizeHand(hand, handicap, () => 0.5)
      assertArrangement(hand, arr)
    }
  })

  it('uses rng among near-ties without foul', () => {
    const rng = mulberry32(7)
    const [hand] = dealHands(rng)
    const a = optimizeHand(hand, 0, () => 0)
    const b = optimizeHand(hand, 0, () => 0.99)
    assertArrangement(hand, a)
    assertArrangement(hand, b)
  })

  it('throws when no legal arrangement is possible (wrong size hand)', () => {
    expect(() => optimizeHand([], 0)).toThrow(/13 cards/)
  })

  it('always finds ≥1 legal arrangement for dealt 13-card hands', () => {
    for (let i = 0; i < 30; i++) {
      const rng = mulberry32(5000 + i)
      const [hand] = dealHands(rng)
      const arr = optimizeHand(hand, 0)
      assertArrangement(hand, arr)
    }
  })
})
