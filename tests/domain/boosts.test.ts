import { describe, expect, it } from 'vitest'
import type { Boost } from '#shared/types/boost'
import type { SkillKey } from '#shared/types/skill'
import { BOOSTS } from '#shared/data/boosts'
import { biggestBoost, boostSize, nearestBoost } from '#shared/domain/boosts'
import { accountWith } from './helpers'

/** A boost from the app's data, by its skill and name. */
function named(skill: SkillKey, name: string): Boost {
  const found = BOOSTS[skill]?.find((boost) => boost.name === name)
  if (!found) throw new Error(`no ${name} for ${skill}`)
  return found
}

describe('boostSize', () => {
  it('gives a flat boost the same at every level', () => {
    const potion = named('fishing', 'Super fishing potion')
    expect([boostSize(potion, 1), boostSize(potion, 90)]).toEqual([6, 6])
  })

  it('gives its base plus a share of the level, rounded down', () => {
    // a mature chef's delight: 2 plus 5% of the Cooking level
    const delight = named('cooking', "Chef's delight(m)")
    expect([28, 66, 99].map((level) => boostSize(delight, level))).toEqual([3, 5, 6])
  })
})

describe('biggestBoost', () => {
  it('counts anything a main can buy', () => {
    expect(biggestBoost(accountWith({ levels: { fishing: 57 } }), 'fishing')).toMatchObject({
      boost: { name: 'Super fishing potion' },
      size: 6,
    })
  })

  it('counts for an ironman only what it can make at its levels', () => {
    const counted = (levels: Partial<Record<SkillKey, number>>) =>
      biggestBoost(accountWith({ type: 'iron', levels }), 'fishing')?.boost.name ?? null
    expect(counted({ herblore: 49, cooking: 69 })).toBeNull()
    expect(counted({ herblore: 50 })).toBe('Fishing potion')
    expect(counted({ herblore: 50, cooking: 70 })).toBe('Admiral pie')
    expect(counted({ herblore: 62, cooking: 70 })).toBe('Super fishing potion')
  })

  it('never counts an ale for an ironman: the stronger mature kind comes by chance', () => {
    expect(biggestBoost(accountWith({ type: 'iron', everySkill: 99 }), 'smithing')).toBeNull()
    expect(biggestBoost(accountWith({ type: 'iron', everySkill: 99 }), 'cooking')).toBeNull()
  })

  it('counts a dragon axe’s special only with the 60 Attack to wield it', () => {
    const counted = (attack: number) =>
      biggestBoost(accountWith({ levels: { attack, woodcutting: 68 } }), 'woodcutting')?.boost.name
    expect(counted(59)).toBe("Axeman's folly(m)")
    expect(counted(60)).toBe('Dragon axe')
  })

  it('has none for a skill no counted boost raises', () => {
    expect(biggestBoost(accountWith({ everySkill: 99 }), 'sailing')).toBeNull()
  })
})

describe('nearestBoost', () => {
  it('names the boost with the fewest levels to train first (acceptance F1)', () => {
    // a super fishing potion is 2 Herblore levels away, an admiral pie 5 Cooking levels
    const iron = accountWith({ type: 'iron', levels: { fishing: 57, herblore: 60, cooking: 65 } })
    expect(nearestBoost(iron, { skill: 'fishing', level: 62 })).toMatchObject({
      boost: { name: 'Super fishing potion' },
      size: 6,
      unlockedBy: { skill: 'herblore', level: 62 },
    })
  })

  it('passes over a boost too small to cover the level', () => {
    // a fishing potion (+3, made at 50 Herblore) would take 57 Fishing only to 60
    const iron = accountWith({ type: 'iron', levels: { fishing: 57, herblore: 49, cooking: 69 } })
    expect(nearestBoost(iron, { skill: 'fishing', level: 62 })?.boost.name).toBe('Admiral pie')
  })

  it('counts a boost got in the same skill from the level that gets it', () => {
    // Trapper's tipple (+2) needs 46 Hunter: one level from 45, and then it reaches 48
    const iron = accountWith({ type: 'iron', levels: { hunter: 45 } })
    expect(nearestBoost(iron, { skill: 'hunter', level: 48 })?.boost.name).toBe("Trapper's tipple")
    expect(nearestBoost(iron, { skill: 'hunter', level: 49 })).toBeNull()
  })

  it('names none that takes as many levels to get as the skill itself would', () => {
    // Grim Tales on the main guide: 71 Woodcutting at 68, and a dragon axe needs 60 Attack
    const main = (attack: number) => accountWith({ levels: { attack, woodcutting: 68 } })
    expect(nearestBoost(main(52), { skill: 'woodcutting', level: 71 })).toBeNull()
    expect(nearestBoost(main(57), { skill: 'woodcutting', level: 71 })).toBeNull()
    expect(nearestBoost(main(58), { skill: 'woodcutting', level: 71 })?.boost.name).toBe(
      'Dragon axe',
    )
  })

  it('names none when the account may count every boost there is already', () => {
    const main = accountWith({ levels: { fishing: 50 } })
    expect(nearestBoost(main, { skill: 'fishing', level: 62 })).toBeNull()
  })
})
