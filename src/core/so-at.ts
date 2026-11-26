import { suitStrength } from './cards'
import type { Card } from './types'

/** Default ante mỗi nhà vào hũ So Át (4 × 15 = 60). */
export const SO_AT_ANTE = 15

/** Pot payouts Nhất / Nhì / Ba / Bét from the default 60-point So Át pot. */
export const SO_AT_POINTS: number[] = [30, 20, 10, 0]

/** Default ante mỗi nhà vào hũ Át to nhất (4 × 5 = 20). */
export const AT_LON_ANTE = 5

const ACE = 12
const TWO = 0

type Metrics = {
  aceCount: number
  aceSuit: number
  twoCount: number
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

/**
 * Positive if a ranks above b (higher So Át place).
 * Order (So Át): aceCount first — 2 Aces always beat 1 Ace, even Ace♥ —
 * then strongest Ace suit only when counts tie and count > 0.
 * Order (So Hai, both 0 Aces): twoCount first, then strongest Two suit.
 */
function compareMetrics(a: Metrics, b: Metrics): number {
  if (a.aceCount !== b.aceCount) return a.aceCount - b.aceCount
  if (a.aceCount > 0) return a.aceSuit - b.aceSuit
  if (a.twoCount !== b.twoCount) return a.twoCount - b.twoCount
  return a.twoSuit - b.twoSuit
}

/**
 * Place payouts for `n` players: keep Nhất/Nhì/… ratios from {@link SO_AT_POINTS},
 * scaled so sum = n * ante (zero-sum after ante).
 */
function placePayoutsForN(n: number, ante: number): number[] {
  const base = SO_AT_POINTS.slice(0, Math.max(n, 1))
  const baseSum = base.reduce((a, b) => a + b, 0) || 1
  const pot = n * ante
  return SO_AT_POINTS.map((p, i) => (i < n ? (p / baseSum) * pot : 0))
}

/**
 * So Át / So Hai net scores for the given hands only (call with occupied seats).
 * @param ante ante mỗi nhà; 0 / bỏ qua → toàn 0.
 */
export function scoreSoAt(
  hands: Card[][],
  ante: number = SO_AT_ANTE,
): number[] {
  const n = hands.length
  if (ante <= 0 || n === 0) return Array.from({ length: n }, () => 0)

  const ms = hands.map(metrics)
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => compareMetrics(ms[j]!, ms[i]!),
  )
  const points = placePayoutsForN(n, ante)

  const payouts = Array.from({ length: n }, () => 0)
  let i = 0
  while (i < n) {
    let j = i + 1
    while (j < n && compareMetrics(ms[order[i]!]!, ms[order[j]!]!) === 0) j++
    const pot = points.slice(i, j).reduce((sum, p) => sum + p, 0)
    const share = pot / (j - i)
    for (let k = i; k < j; k++) payouts[order[k]!] = share
    i = j
  }
  return payouts.map((p) => p - ante)
}

/**
 * Át to nhất. @param ante ante mỗi nhà; 0 → toàn 0.
 */
export function scoreAtLonhat(
  hands: Card[][],
  ante: number = AT_LON_ANTE,
): number[] {
  const n = hands.length
  if (ante <= 0) return Array.from({ length: n }, () => 0)

  const ms = hands.map(metrics)
  const withAces = ms
    .map((m, i) => ({ i, m }))
    .filter((x) => x.m.aceCount > 0)

  const payouts = Array.from({ length: n }, () => 0)
  const pot = ante * n

  if (withAces.length === 0) {
    const share = pot / n
    for (let i = 0; i < n; i++) payouts[i] = share
  } else {
    let best = withAces[0]!
    const winners = [best]
    for (let k = 1; k < withAces.length; k++) {
      const cur = withAces[k]!
      const cmp = compareMetrics(cur.m, best.m)
      if (cmp > 0) {
        best = cur
        winners.length = 0
        winners.push(cur)
      } else if (cmp === 0) {
        winners.push(cur)
      }
    }
    const share = pot / winners.length
    for (const w of winners) payouts[w.i] = share
  }

  return payouts.map((p) => p - ante)
}
