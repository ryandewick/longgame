import { describe, expect, it, vi } from 'vitest'
import {
  bestMethod,
  bestRateAt,
  fastestMethod,
  grindableMethods,
  isUsableAt,
  methodOptions,
  nextUnlock,
  suitsTickPreference,
  supplyFactor,
  withinBudget,
} from '#shared/domain/methods'
import type { MethodOption } from '#shared/domain/methods'
import { parseRequirements } from '#shared/domain/requirements'
import { accountWith, methodWith } from './helpers'

vi.mock('#shared/data/methods', () => import('./sample-methods'))

const names = (options: readonly MethodOption[]) => options.map((option) => option.method.name)

describe('methodOptions', () => {
  it('lists a skill’s methods in the data’s order with the account’s view of each', () => {
    const options = methodOptions(accountWith({ levels: { mining: 30 } }), 'mining')
    expect(names(options)).toEqual([
      'Granite (3-tick)',
      'Iron ore',
      'Crashed stars',
      'Motherlode Mine',
      'Volcanic Mine',
    ])
    expect(options.map((option) => option.unlocked)).toEqual([true, true, true, true, false])
  })

  it('says what a locked method is missing, apart from the level', () => {
    const [, , , , volcanicMine] = methodOptions(accountWith({ levels: { mining: 99 } }), 'mining')
    expect(volcanicMine?.unlocked).toBe(false)
    expect(volcanicMine?.missing).toEqual([{ kind: 'quest', quest: 'Bone Voyage' }])
  })

  it('locks a method on level alone without listing anything missing', () => {
    const [, , crashedStars] = methodOptions(accountWith(), 'mining')
    expect(crashedStars?.unlocked).toBe(false)
    expect(crashedStars?.missing).toEqual([])
  })

  it('hides ironman routes from a main', () => {
    expect(names(methodOptions(accountWith(), 'smithing'))).toEqual(['Bought bars', 'Cannonballs'])
  })

  it('shows an ironman the methods that need the Grand Exchange, marked as missing it', () => {
    const options = methodOptions(accountWith({ type: 'iron' }), 'smithing')
    expect(names(options)).toEqual(['Bought bars', 'Smelted ore', 'Cannonballs'])
    expect(options[0]?.missing).toEqual([{ kind: 'grand-exchange' }])
    expect(options[0]?.unlocked).toBe(false)
  })

  it('gives each method its rate and XP per run at the account’s level', () => {
    const herbRuns = (level: number) =>
      methodOptions(accountWith({ levels: { farming: level } }), 'farming')[0]
    expect(herbRuns(1)).toMatchObject({ xpPerHour: 60_000, xpPerRun: 2_000 })
    expect(herbRuns(50)).toMatchObject({ xpPerHour: 120_000, xpPerRun: 4_000 })
  })
})

describe('withinBudget', () => {
  const pricey = { method: methodWith({ cost: 'pricey' }) } as MethodOption
  const cheap = { method: methodWith({ cost: 'cheap' }) } as MethodOption

  it('keeps everything when money is no object', () => {
    expect(withinBudget(accountWith(), [pricey, cheap])).toEqual([pricey, cheap])
  })

  it('drops the expensive methods on a budget', () => {
    expect(withinBudget(accountWith({ budget: 'cheap' }), [pricey, cheap])).toEqual([cheap])
  })

  it('keeps the expensive methods when there is nothing else', () => {
    expect(withinBudget(accountWith({ budget: 'cheap' }), [pricey])).toEqual([pricey])
  })

  it('ignores the budget for an ironman, who buys nothing', () => {
    const ironman = accountWith({ type: 'iron', budget: 'cheap' })
    expect(withinBudget(ironman, [pricey, cheap])).toEqual([pricey, cheap])
  })
})

describe('suitsTickPreference and supplyFactor', () => {
  it('offers tick-perfect methods only to a player who asked for them', () => {
    const tickMethod = methodWith({ tickPerfect: true })
    expect(suitsTickPreference(accountWith(), tickMethod)).toBe(false)
    expect(suitsTickPreference(accountWith({ tickPerfect: true }), tickMethod)).toBe(true)
    expect(suitsTickPreference(accountWith(), methodWith())).toBe(true)
  })

  it('marks down a method an ironman has to supply', () => {
    const supplied = methodWith({ usesOwnSupplies: true })
    expect(supplyFactor(accountWith({ type: 'iron' }), supplied)).toBe(0.6)
    expect(supplyFactor(accountWith(), supplied)).toBe(1)
    expect(supplyFactor(accountWith({ type: 'iron' }), methodWith())).toBe(1)
  })
})

describe('grindableMethods', () => {
  it('is the unlocked, rated methods', () => {
    const account = accountWith({ levels: { mining: 60 } })
    expect(names(grindableMethods(account, 'mining'))).toEqual([
      'Iron ore',
      'Crashed stars',
      'Motherlode Mine',
    ])
  })

  it('includes tick-perfect methods for a player who wants them', () => {
    const account = accountWith({ tickPerfect: true })
    expect(names(grindableMethods(account, 'mining'))).toEqual(['Granite (3-tick)', 'Iron ore'])
  })

  it('never includes a timed run', () => {
    expect(grindableMethods(accountWith(), 'farming')).toEqual([])
    const account = accountWith({ levels: { farming: 40 } })
    expect(names(grindableMethods(account, 'farming'))).toEqual(['Tithe Farm'])
  })

  it('falls back to the last unlocked method when the wiki rates none', () => {
    expect(names(grindableMethods(accountWith(), 'slayer'))).toEqual(['Turael'])
    const fighter = accountWith({ everySkill: 50 })
    expect(names(grindableMethods(fighter, 'slayer'))).toEqual(['Vannaka'])
  })

  it('leaves expensive methods out on a budget, unless nothing else is left', () => {
    const saver = accountWith({ budget: 'cheap' })
    expect(names(grindableMethods(saver, 'cooking'))).toEqual(['Shrimp'])
    expect(names(grindableMethods(saver, 'construction'))).toEqual(['Mahogany tables'])
  })

  it('is empty for a passive skill', () => {
    expect(grindableMethods(accountWith({ everySkill: 50 }), 'hitpoints')).toEqual([])
  })
})

describe('bestMethod', () => {
  const miner = accountWith({ levels: { mining: 60 } })

  it('leans towards the mood’s intensity', () => {
    // iron ore 30k active, crashed stars 25k AFK, Motherlode Mine 35k semi-AFK
    expect(bestMethod(miner, 'mining', 'afk')?.method.name).toBe('Crashed stars')
    expect(bestMethod(miner, 'mining', 'active')?.method.name).toBe('Iron ore')
    expect(bestMethod(miner, 'mining', 'balanced')?.method.name).toBe('Motherlode Mine')
  })

  it('counts supplies against a method for an ironman', () => {
    const ironman = accountWith({ type: 'iron' })
    // smelted ore is 20k active but needs supplies; cannonballs are 10k AFK
    expect(bestMethod(ironman, 'smithing', 'active')?.method.name).toBe('Smelted ore')
    expect(bestMethod(ironman, 'smithing', 'afk')?.method.name).toBe('Cannonballs')
  })

  it('is null when the skill has nothing to grind', () => {
    expect(bestMethod(accountWith(), 'hitpoints', 'balanced')).toBeNull()
    expect(bestMethod(accountWith(), 'farming', 'balanced')).toBeNull()
    expect(bestMethod(accountWith(), 'sailing', 'balanced')).toBeNull()
  })
})

describe('fastestMethod', () => {
  it('is the highest rate the account can use, whatever its intensity', () => {
    const account = accountWith({ levels: { mining: 60 } })
    expect(fastestMethod(account, 'mining')?.method.name).toBe('Motherlode Mine')
    const quester = accountWith({ levels: { mining: 60 }, quests: ['Bone Voyage'] })
    expect(fastestMethod(quester, 'mining')?.method.name).toBe('Volcanic Mine')
  })

  it('counts timed runs for a skill trained by them, and only for such a skill', () => {
    const account = accountWith({ levels: { farming: 40 } })
    expect(fastestMethod(account, 'farming')?.method.name).toBe('Tree runs')
    expect(fastestMethod(account, 'hunter')?.method.name).toBe('Butterflies')
  })

  it('falls back to the unrated method a block would use', () => {
    expect(fastestMethod(accountWith(), 'slayer')?.method.name).toBe('Turael')
  })

  it('is null for a passive skill', () => {
    expect(fastestMethod(accountWith(), 'hitpoints')).toBeNull()
  })
})

describe('nextUnlock', () => {
  it('is the lowest-level rated method the account cannot use yet', () => {
    expect(nextUnlock(accountWith(), 'mining')?.method.name).toBe('Crashed stars')
    const account = accountWith({ levels: { mining: 20 } })
    expect(nextUnlock(account, 'mining')?.method.name).toBe('Motherlode Mine')
  })

  it('includes a method the account has the level for but not the quest', () => {
    const account = accountWith({ levels: { mining: 99 } })
    expect(nextUnlock(account, 'mining')?.method.name).toBe('Volcanic Mine')
  })

  it('is null once everything is open', () => {
    const account = accountWith({ levels: { mining: 60 }, quests: ['Bone Voyage'] })
    expect(nextUnlock(account, 'mining')).toBeNull()
  })

  it('never promises an ironman a method that needs the Grand Exchange', () => {
    expect(nextUnlock(accountWith({ type: 'iron' }), 'smithing')).toBeNull()
  })

  it('passes over unrated methods', () => {
    expect(nextUnlock(accountWith(), 'slayer')).toBeNull()
  })
})

describe('isUsableAt', () => {
  it('needs the method’s level', () => {
    const method = methodWith({ level: 40 })
    expect(isUsableAt(accountWith(), method, 39)).toBe(false)
    expect(isUsableAt(accountWith(), method, 40)).toBe(true)
  })

  it('reads a requirement on the method’s own skill against the level asked about', () => {
    const method = methodWith({ requirements: parseRequirements('s:mining 70,smithing 30') })
    const account = accountWith({ levels: { smithing: 30 } })
    expect(isUsableAt(account, method, 70)).toBe(true)
    expect(isUsableAt(account, method, 69)).toBe(false)
    expect(isUsableAt(accountWith(), method, 99)).toBe(false)
  })

  it('keeps each account type to its own methods', () => {
    const forMains = methodWith({ audience: 'main' })
    const forIronmen = methodWith({ audience: 'iron' })
    expect(isUsableAt(accountWith(), forMains, 1)).toBe(true)
    expect(isUsableAt(accountWith(), forIronmen, 1)).toBe(false)
    expect(isUsableAt(accountWith({ type: 'iron' }), forMains, 1)).toBe(false)
    expect(isUsableAt(accountWith({ type: 'iron' }), forIronmen, 1)).toBe(true)
  })

  it('rules out expensive methods for a main on a budget, with no fallback', () => {
    const pricey = methodWith({ cost: 'pricey' })
    expect(isUsableAt(accountWith({ budget: 'cheap' }), pricey, 1)).toBe(false)
    expect(isUsableAt(accountWith({ budget: 'cheap', type: 'iron' }), pricey, 1)).toBe(true)
  })

  it('rules out tick-perfect methods unless asked for', () => {
    const tickMethod = methodWith({ tickPerfect: true })
    expect(isUsableAt(accountWith(), tickMethod, 1)).toBe(false)
    expect(isUsableAt(accountWith({ tickPerfect: true }), tickMethod, 1)).toBe(true)
  })
})

describe('bestRateAt', () => {
  it('is the best usable rate at the level asked about, not the account’s own', () => {
    const account = accountWith()
    expect(bestRateAt(account, 'mining', 1)).toBe(30_000)
    expect(bestRateAt(account, 'mining', 30)).toBe(35_000)
    expect(bestRateAt(account, 'mining', 99)).toBe(35_000)
    expect(bestRateAt(accountWith({ quests: ['Bone Voyage'] }), 'mining', 50)).toBe(80_000)
  })

  it('counts timed runs only for a skill trained by them', () => {
    expect(bestRateAt(accountWith(), 'farming', 15)).toBe(500_000)
    expect(bestRateAt(accountWith(), 'hunter', 15)).toBe(5_000)
  })

  it('is zero when nothing usable has a rate', () => {
    expect(bestRateAt(accountWith(), 'slayer', 50)).toBe(0)
    expect(bestRateAt(accountWith(), 'hitpoints', 50)).toBe(0)
    // the one Construction method is expensive: on a budget an estimate has nothing to go on
    expect(bestRateAt(accountWith({ budget: 'cheap' }), 'construction', 50)).toBe(0)
  })
})
