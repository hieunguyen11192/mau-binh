import { describe, expect, it } from 'vitest'
import { LEVELS, shouldBotFold, type LevelId } from '../../src/core/levels'

describe('LEVELS', () => {
  it('Át flags match Ace/hardest difficulty', () => {
    const at = LEVELS.at
    expect(at.labelVi).toBe('Át')
    expect(at.aiHandicap).toBe(0)
    expect(at.aiClaim).toBe(true)
    expect(at.auto).toBe(false)
    expect(at.claimAid).toBe(false)
    expect(at.fold).toBe(true)
    expect(at.peek).toBe(false)
  })

  it('all four level ids are defined with expected handicaps', () => {
    const ids: LevelId[] = ['jo', 'dam', 'gia', 'at']
    expect(Object.keys(LEVELS).sort()).toEqual([...ids].sort())
    expect(LEVELS.jo).toMatchObject({
      labelVi: 'Jô',
      aiHandicap: 6,
      aiClaim: false,
      auto: true,
      claimAid: true,
      fold: false,
      peek: true,
    })
    expect(LEVELS.dam).toMatchObject({
      labelVi: 'Đầm',
      aiHandicap: 4,
      aiClaim: false,
      auto: true,
      claimAid: true,
      fold: false,
      peek: true,
    })
    expect(LEVELS.gia).toMatchObject({
      labelVi: 'Già',
      aiHandicap: 2,
      aiClaim: true,
      auto: true,
      claimAid: true,
      fold: true,
      peek: true,
    })
  })
})

describe('shouldBotFold', () => {
  it('folds only when level.fold and expectedPoints < -3', () => {
    expect(shouldBotFold(-4, 'at')).toBe(true)
    expect(shouldBotFold(-3, 'at')).toBe(false)
    expect(shouldBotFold(-4, 'jo')).toBe(false)
    expect(shouldBotFold(-100, 'dam')).toBe(false)
    expect(shouldBotFold(-4, 'gia')).toBe(true)
  })
})
