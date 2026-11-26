/** Per-table pot options (bot + multiplayer). */
export type TableRules = {
  soAtEnabled: boolean
  /** Ante mỗi nhà vào hũ So Át (mặc định 15). */
  soAtAnte: number
  atLonEnabled: boolean
  /** Ante mỗi nhà vào hũ Át to (mặc định 5). */
  atLonAnte: number
  heoEnabled: boolean
  /** Mỗi ván mỗi nhà bỏ vào rổ heo. */
  heoAnte: number
}

export const DEFAULT_TABLE_RULES: TableRules = {
  soAtEnabled: true,
  soAtAnte: 15,
  atLonEnabled: true,
  atLonAnte: 5,
  heoEnabled: false,
  heoAnte: 5,
}

export function normalizeRules(raw: Partial<TableRules> | null | undefined): TableRules {
  const r = { ...DEFAULT_TABLE_RULES, ...(raw ?? {}) }
  r.soAtAnte = Math.max(0, Math.floor(Number(r.soAtAnte) || 0))
  r.atLonAnte = Math.max(0, Math.floor(Number(r.atLonAnte) || 0))
  r.heoAnte = Math.max(0, Math.floor(Number(r.heoAnte) || 0))
  r.soAtEnabled = Boolean(r.soAtEnabled) && r.soAtAnte > 0
  r.atLonEnabled = Boolean(r.atLonEnabled) && r.atLonAnte > 0
  r.heoEnabled = Boolean(r.heoEnabled) && r.heoAnte > 0
  return r
}
