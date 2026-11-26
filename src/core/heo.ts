import { compareChi, evaluateChi, type Chi } from './hand'
import type { SeatArrangement } from './scoring'

const CHIS: Chi[] = ['front', 'middle', 'back']

function isNormal(seat: SeatArrangement): boolean {
  if (seat.folded) return false
  if ((seat.specialKind ?? 0) > 0) return false
  return true
}

/** True if `a` wins all 3 chis against `b`. */
export function scoopsAllChis(a: SeatArrangement, b: SeatArrangement): boolean {
  for (const chi of CHIS) {
    const cmp = compareChi(evaluateChi(a[chi], chi), evaluateChi(b[chi], chi))
    if (cmp <= 0) return false
  }
  return true
}

/**
 * Absolute scoop: win all 3 chis vs every other normal seat. ≥1 opponent required.
 */
export function findAbsoluteScoopWinner(seats: SeatArrangement[]): number | null {
  const normals = seats
    .map((s, i) => ({ s, i }))
    .filter((x) => isNormal(x.s))
  if (normals.length < 2) return null

  const winners: number[] = []
  for (const cand of normals) {
    const others = normals.filter((o) => o.i !== cand.i)
    if (others.every((o) => scoopsAllChis(cand.s, o.s))) winners.push(cand.i)
  }
  return winners.length === 1 ? winners[0]! : null
}

export type HeoRoundResult = {
  heoScores: number[]
  heoPotAfter: number
  scoopSeat: number | null
  heoPotBeforePayout: number
}

/**
 * Mỗi ghế `payingSeats[i]` bỏ `heoAnte` vào rổ.
 * Rổ = before + tổng ante. Ăn tuyệt đối → nhận cả rổ, rổ = 0.
 */
export function scoreHeoRound(input: {
  seats: SeatArrangement[]
  heoAnte: number
  heoPotBefore: number
  payingSeats: boolean[]
}): HeoRoundResult {
  const n = input.seats.length
  const heoScores = Array.from({ length: n }, () => 0)
  let payCount = 0
  for (let i = 0; i < n; ++i) {
    if (input.payingSeats[i]) {
      heoScores[i]! -= input.heoAnte
      payCount++
    }
  }

  const pot = input.heoPotBefore + payCount * input.heoAnte
  const scoopSeat = findAbsoluteScoopWinner(input.seats)

  if (scoopSeat !== null && pot > 0) {
    heoScores[scoopSeat]! += pot
    return {
      heoScores,
      heoPotAfter: 0,
      scoopSeat,
      heoPotBeforePayout: pot,
    }
  }

  return {
    heoScores,
    heoPotAfter: pot,
    scoopSeat: null,
    heoPotBeforePayout: pot,
  }
}
