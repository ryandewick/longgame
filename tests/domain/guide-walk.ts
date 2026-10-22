import { readFileSync } from 'node:fs'
import type { Account, AccountType } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { QUESTS } from '#shared/data/quests'
import { forEverySkill } from '#shared/data/skills'
import { combatLevel, questPoints } from '#shared/domain/account'
import { provenProgress } from '#shared/domain/quest-proof'
import { diaryReadiness, questReadiness, type Readiness } from '#shared/domain/readiness'
import { levelForXp, xpForLevel } from '#shared/domain/xp'

/*
 * Walks one of the two Optimal quest guides (tests/fixtures/quest-orders.json, exported from the
 * research's orders.json with the guides' notes left out) from a fresh account, as the research's
 * tools/acceptance_cases.py does with its own rules, but with the app's: each training step raises
 * its skill, each quest step pays the guide's XP for it (its own fixed XP when the guide gives
 * none), and every quest and tier is checked for readiness when the guide reaches it.
 */

type XpBySkill = Partial<Record<SkillKey, number>>

interface OrderStep {
  readonly n: number
  readonly kind: 'quest' | 'partial' | 'diary' | 'tiers' | 'train' | 'unlock'
  readonly quest?: string
  readonly diary?: string
  /** For 'tiers': every tier of this difficulty not claimed yet ('All Easy Achievement Diaries'). */
  readonly tier?: string
  readonly skill?: SkillKey
  readonly level?: number
  readonly xp?: XpBySkill
  readonly starts?: readonly string[]
  readonly extraXp?: XpBySkill
}

export type Route = 'main' | 'ironman'

const ORDERS = JSON.parse(
  readFileSync(new URL('../fixtures/quest-orders.json', import.meta.url), 'utf8'),
) as Record<Route, { readonly page: string; readonly rev: number; readonly steps: OrderStep[] }>

/** A quest or tier checked when the guide reached it, and what it still needed then. */
export interface CheckedStep {
  readonly n: number
  readonly name: string
  /** The account as the guide reaches the step. */
  readonly account: Account
  readonly readiness: Readiness
}

export interface GuideWalk {
  readonly steps: number
  readonly checked: readonly CheckedStep[]
  /** Quest points and combat level when the guide reaches these steps. */
  readonly at: (n: number) => { readonly questPoints: number; readonly combat: number }
}

const RECIPE_PARTS = QUEST_FACTS.filter((quest) => quest.kind === 'subquest').map((q) => q.name)

/** A fresh account: 10 Hitpoints (1,154 XP), the only skill a player starts with XP in, and 1 elsewhere. */
export function freshXp(): Record<SkillKey, number> {
  return forEverySkill((skill) => (skill === 'hitpoints' ? xpForLevel(10) : 0))
}

/** Walks the guide's steps in order from a fresh account of this type. */
export function walkGuide(route: Route): GuideWalk {
  const type: AccountType = route === 'ironman' ? 'iron' : 'main'
  const xp = freshXp()
  const done = new Set<string>()
  const started = new Set<string>()
  const diaries = new Set<string>()
  const checked: CheckedStep[] = []
  const milestones = new Map<number, { questPoints: number; combat: number }>()

  const account = (): Account => {
    const proven = provenProgress({
      completedQuests: done,
      startedQuests: started,
      completedDiaries: diaries,
    })
    return {
      type,
      skills: forEverySkill((skill) => ({ level: levelForXp(xp[skill]), xp: xp[skill] })),
      completedQuests: proven.completedQuests,
      startedQuests: proven.startedQuests,
      completedDiaries: proven.completedDiaries,
      allQuests: false,
      allDiaries: false,
      preferences: { budget: 'any', tickPerfect: false, excludedSkills: new Set() },
    }
  }
  const gain = (amounts: XpBySkill | undefined): void => {
    for (const [skill, amount] of Object.entries(amounts ?? {}) as [SkillKey, number][])
      xp[skill] += amount
  }
  const checkQuest = (n: number, name: string, toStart: boolean): void => {
    const facts = QUEST_FACTS.find((quest) => quest.name === name)
    if (!facts) throw new Error(`step ${n}: '${name}' is not a quest entry`)
    const now = account()
    checked.push({ n, name, account: now, readiness: questReadiness(now, facts, toStart) })
  }
  const checkDiary = (n: number, name: string): void => {
    const facts = DIARY_FACTS.find((diary) => diary.name === name)
    if (!facts) throw new Error(`step ${n}: '${name}' is not a tier`)
    const now = account()
    checked.push({ n, name, account: now, readiness: diaryReadiness(now, facts) })
    diaries.add(name)
  }

  for (const step of ORDERS[route].steps) {
    if (step.kind === 'train' && step.skill && step.level) {
      xp[step.skill] = Math.max(xp[step.skill], xpForLevel(step.level))
    } else if (step.kind === 'quest' && step.quest) {
      checkQuest(step.n, step.quest, false)
      done.add(step.quest)
      gain(step.xp ?? QUESTS.find((quest) => quest.name === step.quest)?.fixedXp)
      if (RECIPE_PARTS.every((part) => done.has(part))) done.add('Recipe for Disaster')
    } else if (step.kind === 'partial' && step.quest) {
      checkQuest(step.n, step.quest, true)
      started.add(step.quest)
    } else if (step.kind === 'diary' && step.diary) {
      checkDiary(step.n, step.diary)
    } else if (step.kind === 'tiers' && step.tier) {
      const unclaimed = DIARY_FACTS.filter((d) => d.tier === step.tier && !diaries.has(d.name))
      for (const diary of unclaimed) checkDiary(step.n, diary.name)
    }
    if (step.kind !== 'quest') gain(step.xp)
    for (const quest of step.starts ?? []) started.add(quest)
    gain(step.extraXp)
    const now = account()
    milestones.set(step.n, { questPoints: questPoints(now), combat: combatLevel(now) })
  }

  return {
    steps: ORDERS[route].steps.length,
    checked,
    at: (n) => {
      const found = milestones.get(n)
      if (!found) throw new Error(`no step ${n}`)
      return found
    },
  }
}
