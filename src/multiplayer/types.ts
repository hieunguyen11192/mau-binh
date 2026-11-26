import type { TableRules } from '../core/table-rules'
import type { Arrangement, Card } from '../core/types'

export type MpPlayer = {
  seat: number
  name: string
  connected: boolean
  isHost: boolean
}

export type MpSession = {
  roomId: string
  code: string
  seat: number
  token: string
  name: string
  isHost: boolean
}

export type MpSnapshot = {
  roomId: string
  code: string
  status: 'lobby' | 'arranging' | 'result'
  currentRound: number
  seat: number
  isHost: boolean
  players: MpPlayer[]
  myHand: Card[] | null
  submitted: boolean
  submitCount: number
  roundStatus: 'arranging' | 'result' | null
  settings?: Partial<TableRules>
  heoPot?: number
}

export type MpSubmission = {
  seat: number
  action: 'arrange' | 'fold' | 'claim'
  arrangement: Arrangement | null
}

export type MpReveal = {
  round: number
  hands: Record<string, Card[]>
  submissions: MpSubmission[]
  players: MpPlayer[]
}

const SESSION_KEY = 'mau-binh-mp-session'

export function saveSession(session: MpSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession(): MpSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MpSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
