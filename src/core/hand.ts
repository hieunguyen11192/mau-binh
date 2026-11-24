import type { Card, Rank } from './types'

export type Chi = 'front' | 'middle' | 'back'

/** Junk=0 … RoyalFlush=9 — same order as 13-warriors */
export type Pattern = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

type Feature = { type: number; rank: Rank }

export type ChiEval = {
  pattern: Pattern
  /** Primary feature rank (features[0].rank) — not used for total order */
  strength: number
  /** Feature list for is_smaller_than-style compare */
  features: Feature[]
}

const Junk = 0
const Pair = 1
const TwoPairs = 2
const Triple = 3
const Straight = 4
const Flush = 5
const FullHouse = 6
const Quadruple = 7
const StraightFlush = 8
const RoyalFlush = 9

const Two = 0
const Five = 3
const Ace = 12

/** front / middle / back — copy of 13-warriors pattern_points */
export const PATTERN_POINTS: number[][] = [
  [1, 1, 1, 3, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 2, 8, 10, 20],
  [1, 1, 1, 1, 1, 1, 1, 4, 5, 10],
]

function extractFeatures(cards: Card[]): Feature[] {
  const sorted = cards.slice().sort((a, b) => a.rank - b.rank)
  const features: Feature[] = []
  let numJunks = 0
  let numPairs = 0
  let numTriples = 0
  const length = sorted.length

  for (let i = 0; i < length; ++i) {
    const r = sorted[i].rank
    if (i + 1 >= length || r !== sorted[i + 1].rank) {
      features.push({ type: Junk, rank: r })
      ++numJunks
    } else if (i + 2 >= length || r !== sorted[i + 2].rank) {
      features.push({ type: Pair, rank: r })
      ++numPairs
      i += 1
    } else if (i + 3 >= length || r !== sorted[i + 3].rank) {
      features.push({ type: Triple, rank: r })
      ++numTriples
      i += 2
    } else {
      features.push({ type: Quadruple, rank: r })
      i += 3
    }
  }

  if (numJunks === 5) {
    let highRank: Rank = sorted[4].rank
    let straight = false
    if (sorted[0].rank + 4 === sorted[4].rank) {
      straight = true
    }
    // Special case for 2345A
    if (
      sorted[0].rank === Two &&
      sorted[3].rank === Five &&
      sorted[4].rank === Ace
    ) {
      straight = true
      highRank = Five
    }

    let flush = true
    for (let i = 0; i < length - 1; ++i) {
      if (sorted[i].suit !== sorted[i + 1].suit) {
        flush = false
        break
      }
    }

    if (straight && flush) {
      const type = highRank === Ace ? RoyalFlush : StraightFlush
      features.length = 0
      features.push({ type, rank: highRank })
    } else if (straight) {
      features.length = 0
      features.push({ type: Straight, rank: highRank })
    } else if (flush) {
      features.pop()
      features.push({ type: Flush, rank: highRank })
    }
  }

  features.sort((a, b) =>
    a.type === b.type ? b.rank - a.rank : b.type - a.type,
  )

  if (numPairs === 2) {
    features[0].type = TwoPairs
  }
  if (numTriples === 1 && numPairs === 1) {
    features[0].type = FullHouse
  }

  return features
}

/**
 * Port of 13-warriors WaveEvaluator.is_smaller_than / compare:
 * walk features pairwise by type then rank up to min length;
 * do NOT favor longer feature lists.
 * >0 if a stronger, <0 if b stronger, 0 if equal through min length.
 */
function compareFeatures(a: Feature[], b: Feature[]): number {
  const minLen = Math.min(a.length, b.length)
  for (let i = 0; i < minLen; ++i) {
    if (a[i].type !== b[i].type) return a[i].type - b[i].type
    if (a[i].rank !== b[i].rank) return a[i].rank - b[i].rank
  }
  return 0
}

export function evaluateChi(cards: Card[], _chi: Chi): ChiEval {
  const features = extractFeatures(cards)
  return {
    pattern: features[0].type as Pattern,
    strength: features[0].rank,
    features,
  }
}

/** >0 if a stronger than b (feature-wise, same as is_smaller_than) */
export function compareChi(a: ChiEval, b: ChiEval): number {
  return compareFeatures(a.features, b.features)
}

/** true if front > middle or middle > back */
export function isFoul(
  front: Card[],
  middle: Card[],
  back: Card[],
): boolean {
  const f = evaluateChi(front, 'front')
  const m = evaluateChi(middle, 'middle')
  const b = evaluateChi(back, 'back')
  return compareChi(f, m) > 0 || compareChi(m, b) > 0
}
