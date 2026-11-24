import { describe, expect, it } from 'vitest'
import { optimizeHand } from '../../src/ai/optimizer'
import { dealHands } from '../../src/core/deal'
import { isFoul } from '../../src/core/hand'
import { scoreSoAt } from '../../src/core/so-at'
import { detectSpecial } from '../../src/core/special'
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

const c = (rank: number, suit: number): Card => ({
  rank: rank as Card['rank'],
  suit: suit as Card['suit'],
})

function pad(notable: Card[], startRank: number): Card[] {
  const cards = [...notable]
  for (let r = startRank; r <= 11 && cards.length < 13; r++) {
    for (let s = 0; s <= 3 && cards.length < 13; s++) {
      if (cards.some((x) => x.rank === r && x.suit === s)) continue
      cards.push(c(r, s))
    }
  }
  return cards
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
    expect(a.seatStatuses).toHaveLength(4)
    expect(a.roundScores).toEqual(
      a.chiScores.map((c, i) => c + a.soAtScores[i]!),
    )
    expect(a.soAtScores).toEqual(scoreSoAt(hands))
    expect(a).toEqual(b)
  })

  it('human fold → chi 0 but soAt may be > 0', () => {
    // Fixed hands: seat0 Nhất (3 Aces) → soAt 30; bots still arrange via jo
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
    expect(result.seatStatuses[0]).toEqual({
      folded: true,
      specialKind: 0,
    })
  })

  it('fouled human arrangement treated as fold for chi and foul status', () => {
    const hands = dealHands(mulberry32(7))
    const foul: Arrangement = {
      front: hands[0]!.slice(10, 13),
      middle: hands[0]!.slice(0, 5),
      back: hands[0]!.slice(5, 10),
    }
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
    expect(result.seatStatuses[0]).toEqual({
      folded: true,
      specialKind: 0,
      foul: true,
    })
  })

  it('invalid claim (no special) → folded seatStatus, specialKind 0', () => {
    const junk: Card[] = [
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
    expect(detectSpecial(junk).kind).toBe(0)

    const hands: [Card[], Card[], Card[], Card[]] = [
      junk,
      pad([c(12, 0)], 1),
      pad([c(12, 1)], 2),
      pad([c(12, 2)], 3),
    ]

    const result = playRound({
      level: 'jo',
      human: 'claim',
      hands,
      rng: () => 0.5,
    })

    expect(result.chiScores[0]).toBe(0)
    expect(result.seatStatuses[0]).toEqual({
      folded: true,
      specialKind: 0,
    })
    expect(result.seatStatuses[0]!.foul).toBeUndefined()
  })

  it('valid claim → specialKind > 0 and not folded', () => {
    // Dragon: one of each rank
    const dragon: Card[] = [
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
    expect(detectSpecial(dragon).kind).toBe(4)

    const hands: [Card[], Card[], Card[], Card[]] = [
      dragon,
      pad([c(0, 1), c(0, 2)], 1),
      pad([c(1, 0), c(1, 2)], 2),
      pad([c(2, 0), c(2, 1)], 3),
    ]

    const result = playRound({
      level: 'jo',
      human: 'claim',
      hands,
      rng: () => 0.5,
    })

    expect(result.seatStatuses[0]).toEqual({
      folded: false,
      specialKind: 4,
    })
    expect(result.chiScores[0]).toBeGreaterThan(0)
  })

  it('seatStatuses length 4; normal play has folded false', () => {
    const hands = dealHands(mulberry32(99))
    const human = optimizeHand(hands[0], 0, () => 0)
    const result = playRound({
      level: 'jo',
      human,
      hands,
      rng: () => 0.5,
    })
    expect(result.seatStatuses).toHaveLength(4)
    expect(result.seatStatuses[0]).toEqual({
      folded: false,
      specialKind: 0,
    })
    for (const s of result.seatStatuses) {
      expect(typeof s.folded).toBe('boolean')
      expect(typeof s.specialKind).toBe('number')
    }
  })
})
