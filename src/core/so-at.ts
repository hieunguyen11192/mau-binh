import { suitStrength } from './cards'
import type { Card } from './types'

/** Each seat antes this into the So Át pot (4 × 15 = 60). */
export const SO_AT_ANTE = 15

/** Pot payouts Nhất / Nhì / Ba / Bét from the 60-point So Át pot. */
export const SO_AT_POINTS: number[] = [30, 20, 10, 0]

/** Each seat antes this into the Át to nhất pot (4 × 5 = 20). */
export const AT_LON_ANTE = 5

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
 * So Át / So Hai net scores: each seat antes {@link SO_AT_ANTE}, pot 60 is paid
 * out as {@link SO_AT_POINTS} by rank; returned values are payout − ante (zero-sum).
 */
export function scoreSoAt(hands: Card[][]): number[] {
  const n = hands.length
  const ms = hands.map(metrics)
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => compareMetrics(ms[j], ms[i]),
  )

  const payouts = Array.from({ length: n }, () => 0)
  let i = 0
  while (i < n) {
    let j = i + 1
    while (j < n && compareMetrics(ms[order[i]], ms[order[j]]) === 0) j++
    const pot = SO_AT_POINTS.slice(i, j).reduce((sum, p) => sum + p, 0)
    const share = pot / (j - i)
    for (let k = i; k < j; k++) payouts[order[k]] = share
    i = j
  }
  return payouts.map((p) => p - SO_AT_ANTE)
}

/**
 * Át to nhất: each seat antes {@link AT_LON_ANTE} (pot 20). Seat with the
 * strongest Ace (♥ > ♦ > ♣ > ♠) takes the pot. No Aces → pot split evenly (net 0).
 * Returned values are payout − ante (zero-sum).
 */
export function scoreAtLonhat(hands: Card[][]): number[] {
  const n = hands.length
  const ms = hands.map(metrics)
  const withAces = ms
    .map((m, i) => ({ i, m }))
    .filter((x) => x.m.aceCount > 0)

  const payouts = Array.from({ length: n }, () => 0)
  const pot = AT_LON_ANTE * n

  if (withAces.length === 0) {
    const share = pot / n
    for (let i = 0; i < n; i++) payouts[i] = share
  } else {
    let best = withAces[0]!
    for (let k = 1; k < withAces.length; k++) {
      const cur = withAces[k]!
      if (cur.m.aceSuit > best.m.aceSuit) best = cur
    }
    payouts[best.i] = pot
  }

  return payouts.map((p) => p - AT_LON_ANTE)
}
