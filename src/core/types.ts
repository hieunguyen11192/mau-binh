/** Suit: 0=♠, 1=♣, 2=♦, 3=♥ — higher = stronger for So Át */
export type Suit = 0 | 1 | 2 | 3

/** Rank: Two=0 … Ace=12 (13-warriors order) */
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type Card = {
  rank: Rank
  suit: Suit
}

/** 3 + 5 + 5 chi layout */
export type Arrangement = {
  front: Card[]
  middle: Card[]
  back: Card[]
}
