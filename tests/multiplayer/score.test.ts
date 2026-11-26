import { describe, expect, it } from 'vitest'
import { scoreMultiplayerReveal } from '../../src/multiplayer/score'
import type { Card } from '../../src/core/types'

const c = (rank: number, suit: number): Card => ({
  rank: rank as Card['rank'],
  suit: suit as Card['suit'],
})

function pad(cards: Card[]): Card[] {
  const out = [...cards]
  for (let r = 1; r <= 11 && out.length < 13; r++) {
    for (let s = 0; s <= 3 && out.length < 13; s++) {
      if (out.some((x) => x.rank === r && x.suit === s)) continue
      out.push(c(r, s))
    }
  }
  return out
}

describe('scoreMultiplayerReveal', () => {
  it('scores 2 active seats; empty seats fold', () => {
    const hand0 = pad([c(12, 3), c(12, 2)])
    const hand1 = pad([c(11, 0), c(11, 1)])
    const result = scoreMultiplayerReveal(
      {
        '0': hand0,
        '1': hand1,
        '2': [],
        '3': [],
      },
      [
        {
          seat: 0,
          action: 'fold',
          arrangement: null,
        },
        {
          seat: 1,
          action: 'fold',
          arrangement: null,
        },
      ],
    )
    expect(result.roundScores.reduce((a, b) => a + b, 0)).toBe(0)
    expect(result.seatStatuses[0]?.folded).toBe(true)
    expect(result.seatStatuses[1]?.folded).toBe(true)
  })
})
