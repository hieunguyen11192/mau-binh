import { suitStrength } from './cards'
import type { Card } from './types'

/** Nhất / Nhì / Ba / Bét — additive So Át bonuses */
export const SO_AT_POINTS: number[] = [30, 20, 10, 0]

const ACE = 12
const TWO = 0

type Metrics = {
  aceCount: number
  /** Strongest Ace suit strength; unused when aceCount === 0 */
  aceSuit: number
  twoCount: number
  /** Strongest Two suit strength; unused when twoCount === 0 */
  twoSuit: number
}

function metrics(hand: Card[]): Metrics {
  const aces = hand.filter((card) => card.rank === ACE)
  const twos = hand.filter((card) => card.rank === TWO)
  return {
    aceCount: aces.length,
    aceSuit: aces.length
      ? Math.max(...aces.map((a) => suitStrength(a.suit)))
      : -1,
    twoCount: twos.length,
    twoSuit: twos.length
      ? Math.max(...twos.map((t) => suitStrength(t.suit)))
      : -1,
  }
}

/** Positive if a ranks above b (higher So Át place). */
function compareMetrics(a: Metrics, b: Metrics): number {
  if (a.aceCount !== b.aceCount) return a.aceCount - b.aceCount
  if (a.aceCount > 0) return a.aceSuit - b.aceSuit
  // Remaining group all 0 Aces → So Hai
  if (a.twoCount !== b.twoCount) return a.twoCount - b.twoCount
  return a.twoSuit - b.twoSuit
}

/**
 * So Át / So Hai bonuses for four dealt 13-card hands.
 * Arrangement and fold status are irrelevant — only Ace/Two counts & suits.
 */
export function scoreSoAt(hands: Card[][]): number[] {
  const n = hands.length
  const ms = hands.map(metrics)
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => compareMetrics(ms[j], ms[i]),
  )

  const bonuses = Array.from({ length: n }, () => 0)
  let i = 0
  while (i < n) {
    let j = i + 1
    while (j < n && compareMetrics(ms[order[i]], ms[order[j]]) === 0) j++
    const pot = SO_AT_POINTS.slice(i, j).reduce((sum, p) => sum + p, 0)
    const share = pot / (j - i)
    for (let k = i; k < j; k++) bonuses[order[k]] = share
    i = j
  }
  return bonuses
}
