import type { Arrangement, Card, Rank } from './types'

/** None=0, ThreeStraights=1, ThreeFlushes=2, SixPairs=3, Dragon=4 */
export type SpecialKind = 0 | 1 | 2 | 3 | 4

const None = 0
const ThreeStraights = 1
const ThreeFlushes = 2
const SixPairs = 3
const Dragon = 4

const Ace = 12 as Rank

/** None, ThreeStraights, ThreeFlushes, SixPairs, Dragon — 13-warriors */
export const SPECIAL_POINTS = [0, 6, 6, 6, 13] as const

export type SpecialResult = {
  kind: SpecialKind
  points: number
  arranged?: Arrangement
}

function toArrangement(ordered: Card[]): Arrangement {
  return {
    front: ordered.slice(0, 3),
    middle: ordered.slice(3, 8),
    back: ordered.slice(8, 13),
  }
}

function isStraight(cards: Card[]): boolean {
  for (let i = 0; i < cards.length - 1; ++i) {
    if (cards[i].rank + 1 !== cards[i + 1].rank) return false
  }
  return true
}

function isFlush(cards: Card[]): boolean {
  for (let i = 0; i < cards.length - 1; ++i) {
    if (cards[i].suit !== cards[i + 1].suit) return false
  }
  return true
}

function dragon(hand: Card[]): boolean {
  hand.sort((a, b) => a.rank - b.rank)
  return isStraight(hand)
}

function sixPairs(hand: Card[]): boolean {
  hand.sort((a, b) => a.rank - b.rank)
  let numPairs = 0
  for (let i = 0; i < 12; ++i) {
    if (hand[i].rank === hand[i + 1].rank) {
      ++numPairs
      i += 1
    }
  }
  return numPairs === 6
}

/** Mutates hand order on success into front(3)+middle(5)+back(5). */
function threeFlushes(hand: Card[]): boolean {
  hand.sort((a, b) => a.suit - b.suit)
  if (
    isFlush(hand.slice(0, 3)) &&
    isFlush(hand.slice(3, 8)) &&
    isFlush(hand.slice(8, 13))
  ) {
    return true
  }
  if (
    isFlush(hand.slice(0, 5)) &&
    isFlush(hand.slice(5, 8)) &&
    isFlush(hand.slice(8, 13))
  ) {
    const ordered = hand
      .slice(5, 8)
      .concat(hand.slice(0, 5), hand.slice(8, 13))
    hand.splice(0, 13, ...ordered)
    return true
  }
  if (
    isFlush(hand.slice(0, 5)) &&
    isFlush(hand.slice(5, 10)) &&
    isFlush(hand.slice(10, 13))
  ) {
    const ordered = hand
      .slice(10, 13)
      .concat(hand.slice(0, 5), hand.slice(5, 10))
    hand.splice(0, 13, ...ordered)
    return true
  }
  return false
}

function computeRankBuckets(
  cards: Card[],
  numRotatedAces: number,
): Card[][] {
  const buckets: Card[][] = [[], [], [], [], [], [], [], [], [], [], [], [], []]
  for (const card of cards) {
    buckets[card.rank].push(card)
  }
  if (numRotatedAces > 0) {
    // Shift buckets right; convert Aces to Ones (wrap Ace under Two).
    buckets.unshift([])
    for (let i = 0; i < numRotatedAces; ++i) {
      buckets[0].push(buckets[13].pop()!)
    }
  }
  return buckets
}

function removeStraight(buckets: Card[][], length: number): Card[] {
  let i = 0
  for (; i < buckets.length; ++i) {
    if (buckets[i].length !== 0) break
  }
  for (let j = 1; j < length; ++j) {
    if (i + j >= buckets.length || buckets[i + j].length === 0) return []
  }
  const wave: Card[] = []
  for (let j = 0; j < length; ++j) {
    wave.push(buckets[i + j].pop()!)
  }
  return wave
}

function threeStraightsWithBuckets(
  hand: Card[],
  numRotatedAces: number,
  out: { ordered: Card[] },
): boolean {
  let buckets = computeRankBuckets(hand, numRotatedAces)
  let front = removeStraight(buckets, 3)
  let center = removeStraight(buckets, 5)
  let back = removeStraight(buckets, 5)
  if (front.length && center.length && back.length) {
    out.ordered = [...front, ...center, ...back]
    return true
  }
  buckets = computeRankBuckets(hand, numRotatedAces)
  center = removeStraight(buckets, 5)
  front = removeStraight(buckets, 3)
  back = removeStraight(buckets, 5)
  if (front.length && center.length && back.length) {
    out.ordered = [...front, ...center, ...back]
    return true
  }
  buckets = computeRankBuckets(hand, numRotatedAces)
  center = removeStraight(buckets, 5)
  back = removeStraight(buckets, 5)
  front = removeStraight(buckets, 3)
  if (front.length && center.length && back.length) {
    out.ordered = [...front, ...center, ...back]
    return true
  }
  return false
}

function threeStraights(
  hand: Card[],
  out: { ordered: Card[] },
): boolean {
  if (threeStraightsWithBuckets(hand, 0, out)) return true

  const buckets = computeRankBuckets(hand, 0)
  const numAces = buckets[Ace].length
  if (numAces === 0) return false

  for (let i = 0; i < numAces; ++i) {
    if (threeStraightsWithBuckets(hand, i + 1, out)) return true
  }
  return false
}

/**
 * Detect whole-hand special (port of 13-warriors SpecialPattern).
 * Priority: Dragon > SixPairs > ThreeFlushes > ThreeStraights > None.
 */
export function detectSpecial(hand: Card[]): SpecialResult {
  const copy = hand.slice()

  if (dragon(copy)) {
    return { kind: Dragon, points: SPECIAL_POINTS[Dragon] }
  }

  const sixCopy = hand.slice()
  if (sixPairs(sixCopy)) {
    return { kind: SixPairs, points: SPECIAL_POINTS[SixPairs] }
  }

  const flushCopy = hand.slice()
  if (threeFlushes(flushCopy)) {
    return {
      kind: ThreeFlushes,
      points: SPECIAL_POINTS[ThreeFlushes],
      arranged: toArrangement(flushCopy),
    }
  }

  const straightOut: { ordered: Card[] } = { ordered: [] }
  if (threeStraights(hand.slice(), straightOut)) {
    return {
      kind: ThreeStraights,
      points: SPECIAL_POINTS[ThreeStraights],
      arranged: toArrangement(straightOut.ordered),
    }
  }

  return { kind: None, points: SPECIAL_POINTS[None] }
}
