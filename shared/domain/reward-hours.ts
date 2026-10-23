import type { Account } from '../types/account'
import type { DiaryFacts } from '../types/diary'
import type { LevelNeed, QuestFacts, XpChoice } from '../types/quest'
import type { SkillKey } from '../types/skill'
import { QUESTS } from '../data/quests'
import { SKILL_KEYS } from '../data/skills'
import { withXp } from './account'
import { hoursForXp } from './estimates'
import { xpForLevel } from './xp'

/*
 * The hours the XP a quest or a diary tier pays takes off an account's time to max: what the
 * account's best methods would take to earn it, from where the account is. XP a player places
 * goes where it saves the most hours, or where a few levels open what the planner is steering
 * towards (decision 3). XP paid along a run of quests is added as it comes, so two rewards in one
 * skill are never both valued at the cheaper rate of the first.
 */

/** Where a reward with a choice of skill goes, and why. */
export interface PlacedXp {
  readonly skill: SkillKey
  readonly xp: number
  /** 'hours': where it saves the most; 'level': towards a level something the planner steers to needs. */
  readonly reason: 'hours' | 'level'
}

/** The hours XP takes off the time to max, and where the XP with a choice of skill goes. */
export interface RewardHours {
  readonly hours: number
  /** Each placed reward in the order paid, one entry a lamp: two of The Tourist Trap's. */
  readonly placed: readonly PlacedXp[]
}

const FIXED_XP: ReadonlyMap<string, Readonly<Partial<Record<SkillKey, number>>>> = new Map(
  QUESTS.map((quest) => [quest.name, quest.fixedXp]),
)

/** The skills a choice may go in at the account's levels. */
function allowedSkills(account: Account, choice: XpChoice): SkillKey[] {
  const listed = choice.skills === 'any' ? SKILL_KEYS : choice.skills
  return listed.filter((skill) => account.skills[skill].level >= choice.minLevel)
}

/**
 * Where one reward of a choice goes. Towards the first level the planner steers to that it may go
 * in, when the account lacks that level and the XP still to come from the choice (`xpToCome`, this
 * reward's included) reaches it: a few levels that open something. Otherwise where its XP saves
 * the most hours, the first such skill in hiscores order on a tie. Null when no skill may take it.
 */
function placeOne(
  account: Account,
  choice: XpChoice,
  steer: readonly LevelNeed[],
  xpToCome: number,
): PlacedXp | null {
  const allowed = allowedSkills(account, choice)
  const towards = steer.find(
    ({ skill, level }) =>
      allowed.includes(skill) &&
      account.skills[skill].level < level &&
      xpForLevel(level) - account.skills[skill].xp <= xpToCome,
  )
  if (towards) return { skill: towards.skill, xp: choice.xp, reason: 'level' }
  let best: { readonly skill: SkillKey; readonly hours: number } | null = null
  for (const skill of allowed) {
    const hours = hoursForXp(account, skill, choice.xp)
    if (!best || hours > best.hours) best = { skill, hours }
  }
  return best && { skill: best.skill, xp: choice.xp, reason: 'hours' }
}

/** Pays XP into a running account, adding up the hours it takes off. */
class Payer {
  account: Account
  hours = 0
  readonly placed: PlacedXp[] = []

  constructor(
    account: Account,
    private readonly steer: readonly LevelNeed[],
  ) {
    this.account = account
  }

  pay(skill: SkillKey, xp: number): void {
    this.hours += hoursForXp(this.account, skill, xp)
    this.account = withXp(this.account, skill, xp)
  }

  choose(choice: XpChoice): void {
    for (let count = 0; count < choice.count; count++) {
      const xpToCome = (choice.count - count) * choice.xp
      const placed = placeOne(this.account, choice, this.steer, xpToCome)
      if (!placed) return
      this.placed.push(placed)
      this.pay(placed.skill, placed.xp)
    }
  }

  result(): RewardHours {
    return { hours: this.hours, placed: this.placed }
  }
}

/**
 * The hours the XP of these quests takes off the account's time to max, paid in the order given:
 * each quest's fixed XP, the XP it pays during the quest, then the rewards the player places.
 * `steer` names levels the planner is heading for, which placed XP goes towards first.
 */
export function questRewardHours(
  account: Account,
  quests: readonly QuestFacts[],
  steer: readonly LevelNeed[] = [],
): RewardHours {
  const payer = new Payer(account, steer)
  for (const quest of quests) {
    const fixed = FIXED_XP.get(quest.name) ?? {}
    for (const skill of SKILL_KEYS) {
      const xp = (fixed[skill] ?? 0) + (quest.gives.xpDuring[skill] ?? 0)
      if (xp) payer.pay(skill, xp)
    }
    for (const choice of quest.gives.xpChoices) payer.choose(choice)
  }
  return payer.result()
}

/** The hours a diary tier's lamp takes off the account's time to max, placed as a quest's is. */
export function diaryRewardHours(
  account: Account,
  diary: DiaryFacts,
  steer: readonly LevelNeed[] = [],
): RewardHours {
  const payer = new Payer(account, steer)
  if (diary.lamp)
    payer.choose({ count: 1, xp: diary.lamp.xp, skills: 'any', minLevel: diary.lamp.minLevel })
  return payer.result()
}
