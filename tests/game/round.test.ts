import { describe, expect, it } from 'vitest'
import { optimizeHand } from '../../src/ai/optimizer'
import { dealHands } from '../../src/core/deal'
import { isFoul } from '../../src/core/hand'
import { scoreSoAt } from '../../src/core/so-at'
import { playRound } from '../../src/game/round'
import type { Arrangement, Card } from '../../src/core/types'

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

describe('playRound', () => {
  it('fixed dealt hands + fixed human arrangement → deterministic totals', () => {
    const rng = mulberry32(20261124)
    const hands = dealHands(mulberry32(20261124))
    const human = optimizeHand(hands[0], 0, () => 0)
    expect(isFoul(human.front, human.middle, human.back)).toBe(false)

    const a = playRound({ level: 'jo', human, hands, rng })
    const b = playRound({
      level: 'jo',
      human,
      hands,
      rng: mulberry32(20261124),
    })

    expect(a.chiScores).toHaveLength(4)
    expect(a.soAtScores).toHaveLength(4)
    expect(a.roundScores).toHaveLength(4)
    expect(a.botArrangements).toHaveLength(3)
    expect(a.roundScores).toEqual(
      a.chiScores.map((c, i) => c + a.soAtScores[i]!),
    )
    expect(a.soAtScores).toEqual(scoreSoAt(hands))
    expect(a).toEqual(b)
  })

  it('human fold → chi 0 but soAt may be > 0', () => {
    // Fixed hands: seat0 Nhất (3 Aces) → soAt 30; bots still arrange via jo
    const c = (rank: number, suit: number): Card => ({
      rank: rank as Card['rank'],
      suit: suit as Card['suit'],
    })
    const pad = (notable: Card[], startRank: number): Card[] => {
      const cards = [...notable]
      for (let r = startRank; r <= 11 && cards.length < 13; r++) {
        for (let s = 0; s <= 3 && cards.length < 13; s++) {
          if (cards.some((x) => x.rank === r && x.suit === s)) continue
          cards.push(c(r, s))
        }
      }
      return cards
    }
    const hands: [Card[], Card[], Card[], Card[]] = [
      pad([c(12, 0), c(12, 1), c(12, 2)], 3), // 3 Aces → Nhất
      pad([c(12, 3)], 1), // 1 Ace
      pad([c(0, 0), c(0, 1)], 2), // 0 Ace, 2 Twos
      pad([c(0, 2)], 4), // 0 Ace, 1 Two
    ]
    expect(scoreSoAt(hands)[0]).toBe(30)

    const result = playRound({
      level: 'jo',
      human: 'fold',
      hands,
      rng: () => 0.5,
    })

    expect(result.chiScores[0]).toBe(0)
    expect(result.soAtScores[0]).toBe(30)
    expect(result.roundScores[0]).toBe(30)
  })

  it('fouled human arrangement treated as fold for chi', () => {
    const hands = dealHands(mulberry32(7))
    const foul: Arrangement = {
      front: hands[0]!.slice(10, 13), // strongest leftover chunk up front
      middle: hands[0]!.slice(0, 5),
      back: hands[0]!.slice(5, 10),
    }
    // Force a known foul: triple Aces front if present, else swap ranks high→front
    const sorted = hands[0]!.slice().sort((a, b) => b.rank - a.rank)
    foul.front = sorted.slice(0, 3)
    foul.middle = sorted.slice(3, 8)
    foul.back = sorted.slice(8, 13)
    expect(isFoul(foul.front, foul.middle, foul.back)).toBe(true)

    const result = playRound({
      level: 'jo',
      human: foul,
      hands,
      rng: () => 0.5,
    })
    expect(result.chiScores[0]).toBe(0)
  })
})
