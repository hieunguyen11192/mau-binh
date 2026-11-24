export type LevelId = 'jo' | 'dam' | 'gia' | 'at'

export type LevelDef = {
  labelVi: string
  aiHandicap: number
  aiClaim: boolean
  auto: boolean
  claimAid: boolean
  fold: boolean
  peek: boolean
}

/** fold if level.fold && expectedPoints < -fold_points */
export const FOLD_POINTS = 3

export const LEVELS: Record<LevelId, LevelDef> = {
  jo: {
    labelVi: 'Jô',
    aiHandicap: 6,
    aiClaim: false,
    auto: true,
    claimAid: true,
    fold: false,
    peek: true,
  },
  dam: {
    labelVi: 'Đầm',
    aiHandicap: 4,
    aiClaim: false,
    auto: true,
    claimAid: true,
    fold: false,
    peek: true,
  },
  gia: {
    labelVi: 'Già',
    aiHandicap: 2,
    aiClaim: true,
    auto: true,
    claimAid: true,
    fold: true,
    peek: true,
  },
  at: {
    labelVi: 'Át',
    aiHandicap: 0,
    aiClaim: true,
    auto: false,
    claimAid: false,
    fold: true,
    peek: false,
  },
}

/** Fold when the level allows folding and expected EV is worse than -fold_points. */
export function shouldBotFold(
  expectedPoints: number,
  level: LevelId,
): boolean {
  return LEVELS[level].fold && expectedPoints < -FOLD_POINTS
}
