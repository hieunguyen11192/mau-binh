import type { TableRules } from '../core/table-rules'
import type { Arrangement } from '../core/types'
import { getSupabase } from './supabase'
import type { MpReveal, MpSession, MpSnapshot } from './types'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export async function createRoom(
  playerName: string,
  settings?: TableRules,
): Promise<MpSession> {
  const data = await rpc<MpSession & { settings?: TableRules; heoPot?: number }>(
    'mb_create_room',
    {
      player_name: playerName,
      p_settings: settings ?? null,
    },
  )
  return {
    roomId: data.roomId,
    code: data.code,
    seat: data.seat,
    token: data.token,
    name: data.name,
    isHost: data.isHost,
  }
}

export async function updateSettings(
  roomId: string,
  token: string,
  settings: TableRules,
): Promise<MpSnapshot> {
  return rpc<MpSnapshot>('mb_update_settings', {
    p_room_id: roomId,
    p_token: token,
    p_settings: settings,
  })
}

export async function setHeoPot(
  roomId: string,
  token: string,
  heoPot: number,
): Promise<MpSnapshot> {
  return rpc<MpSnapshot>('mb_set_heo_pot', {
    p_room_id: roomId,
    p_token: token,
    p_heo_pot: heoPot,
  })
}

export async function leaveRoom(
  roomId: string,
  token: string,
): Promise<void> {
  await rpc<{ ok: boolean }>('mb_leave_room', {
    p_room_id: roomId,
    p_token: token,
  })
}

export async function joinRoom(
  code: string,
  playerName: string,
): Promise<MpSession> {
  const data = await rpc<{
    roomId: string
    code: string
    seat: number
    token: string
    name: string
    isHost: boolean
  }>('mb_join_room', {
    room_code: code,
    player_name: playerName,
  })
  return {
    roomId: data.roomId,
    code: data.code,
    seat: data.seat,
    token: data.token,
    name: data.name,
    isHost: data.isHost,
  }
}

export async function fetchSnapshot(
  roomId: string,
  token: string,
): Promise<MpSnapshot> {
  return rpc<MpSnapshot>('mb_room_snapshot', {
    p_room_id: roomId,
    p_token: token,
  })
}

export async function startRound(
  roomId: string,
  token: string,
): Promise<MpSnapshot> {
  return rpc<MpSnapshot>('mb_start_round', {
    p_room_id: roomId,
    p_token: token,
  })
}

export async function submitPlay(
  roomId: string,
  token: string,
  action: 'arrange' | 'fold' | 'claim',
  arrangement?: Arrangement | null,
): Promise<MpSnapshot> {
  return rpc<MpSnapshot>('mb_submit_play', {
    p_room_id: roomId,
    p_token: token,
    p_action: action,
    p_arrangement: arrangement ?? null,
  })
}

export async function revealRound(
  roomId: string,
  token: string,
): Promise<MpReveal> {
  return rpc<MpReveal>('mb_reveal_round', {
    p_room_id: roomId,
    p_token: token,
  })
}
