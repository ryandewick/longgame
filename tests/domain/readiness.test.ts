import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Account } from '#shared/types/account'
import type { DiaryFacts } from '#shared/types/diary'
import type { QuestFacts } from '#shared/types/quest'
import { DIARY_FACTS } from '#shared/data/diary-facts'
import { QUEST_FACTS } from '#shared/data/quest-facts'
import { combatLevel, hasCompletedQuest, questPoints } from '#shared/domain/account'
import { kudosWithinReach } from '#shared/domain/kudos'
import {
  diaryReadiness,
  questReadiness,
  type Readiness,
  type ReadinessGap,
} from '#shared/domain/readiness'
import { accountFromSave, migrateLegacySave, type LegacySaveV1 } from '#shared/domain/save'
import { walkGuide, type CheckedStep } from './guide-walk'
import { accountWith, diaryFactsWith, freshAccount, questFactsWith } from './helpers'

/*
 * Readiness, checked against the research's acceptance cases (release/research/quests/
 * acceptance.md): the rules on their own, the two Optimal quest guides walked from a fresh account
 * (tests/fixtures/quest-orders.json), and the test fixture account.
 */

const quest = (name: string): QuestFacts => {
  const found = QUEST_FACTS.find((facts) => facts.name === name)
  if (!found) throw new Error(`no quest ${name}`)
  return found
}

const diary = (name: string): DiaryFacts => {
  const found = DIARY_FACTS.find((facts) => facts.name === name)
  if (!found) throw new Error(`no tier ${name}`)
  return found
}

/** A gap in a few words, so the cases read as acceptance.md writes them. */
function inWords(gap: ReadinessGap): string {
  switch (gap.kind) {
    case 'lower-tier':
      return `lower tier ${gap.diary}`
    case 'quest':
      return `quest ${gap.quest}${gap.state === 'started' ? ' (started)' : ''}`
    case 'skill': {
      const boost = gap.nearestBoost
        ? `; ${gap.nearestBoost.boost.name} at ${gap.nearestBoost.unlockedBy.level} ${gap.nearestBoost.unlockedBy.skill}`
        : ''
      return `${gap.level} ${gap.skill} (has ${gap.has}${boost})`
    }
    case 'quest-points':
      return `${gap.needed} quest points (has ${gap.has})`
    case 'combat':
      return `combat ${gap.level} (has ${gap.has})`
    case 'kudos':
      return `${gap.needed} Kudos (${gap.withinReach} within reach)`
    case 'choice':
      return `one of: ${gap.choice.note ?? 'unnamed'}`
    case 'all-quests':
      return `every quest (${gap.left} left)`
    case 'ironman': {
      const options = gap.options.map((option) =>
        option.map(({ skill, level }) => `${level} ${skill}`).join(' and '),
      )
      return `ironman: ${gap.need ? `${gap.need}, ` : ''}${options.join(' or ')}`
    }
  }
}

const missing = (readiness: Readiness): string[] => readiness.missing.map(inWords)

const boosted = (readiness: Readiness): string[] =>
  readiness.boosted.map(
    ({ skill, level, has, boost }) =>
      `${level} ${skill} (has ${has}; ${boost.boost.name} +${boost.size})`,
  )

describe('questReadiness', () => {
  const swanSong = questFactsWith('Swan Song', {
    requires: ['Garden of Tranquillity'],
    requiresStarted: ['The Restless Ghost'],
    levels: { fishing: 62, magic: 66 },
    needs: { ...questFactsWith('').needs, questPoints: 100, combat: 40, kudos: 50 },
  })

  it('lists what the account lacks: quests, levels, quest points, combat and Kudos, in that order', () => {
    expect(missing(questReadiness(freshAccount(), swanSong))).toEqual([
      'quest Garden of Tranquillity',
      'quest The Restless Ghost (started)',
      // in the game's skill order
      '66 magic (has 1)',
      '62 fishing (has 1)',
      // Learning the Ropes, which every account has done, gives one
      '100 quest points (has 1)',
      'combat 40 (has 3)',
      '50 Kudos (0 within reach)',
    ])
  })

  it('is ready once every need is met, a quest needed only started by a finished one too', () => {
    const account = accountWith({
      everySkill: 99,
      quests: ['Garden of Tranquillity', 'The Restless Ghost'],
      allQuests: true,
    })
    expect(questReadiness(account, swanSong)).toEqual({ missing: [], boosted: [] })
    const started = freshAccount({ started: ['The Restless Ghost'] })
    expect(missing(questReadiness(started, swanSong))).not.toContain(
      'quest The Restless Ghost (started)',
    )
  })

  it('never lets a level its page says can be got round stand in the way', () => {
    const ikov = questFactsWith('Desert Treasure I', {
      levels: { slayer: 10, magic: 50 },
      needs: { ...questFactsWith('').needs, bypassable: ['slayer'] },
    })
    expect(missing(questReadiness(freshAccount(), ikov))).toEqual(['50 magic (has 1)'])
    expect(quest('Desert Treasure I').needs.bypassable).toEqual(['slayer'])
  })

  it('leaves out the levels needed only to finish, and an ironman’s, when asked about starting', () => {
    const facts = questFactsWith('Quest', {
      levels: { fishing: 62, magic: 66 },
      needs: {
        ...questFactsWith('').needs,
        finishOnly: ['magic'],
        ironman: [
          { need: 'steel nails', options: [[{ skill: 'smithing', level: 34 }]], condition: null },
        ],
      },
    })
    const iron = freshAccount({ type: 'iron' })
    expect(missing(questReadiness(iron, facts, true))).toEqual(['62 fishing (has 1)'])
    expect(missing(questReadiness(iron, facts))).toEqual([
      '66 magic (has 1)',
      '62 fishing (has 1)',
      'ironman: steel nails, 34 smithing',
    ])
  })

  it('counts a boost toward a boostable level and names it (decision 1, acceptance F1)', () => {
    // a super fishing potion (+6) is tradeable, so a main at 57 Fishing is ready for Swan Song's 62
    const main = accountWith({ everySkill: 99, levels: { fishing: 57 }, allQuests: true })
    const ready = questReadiness(main, quest('Swan Song'))
    expect(missing(ready)).toEqual([])
    expect(boosted(ready)).toEqual(['62 fishing (has 57; Super fishing potion +6)'])

    // an ironman has to make it (62 Herblore) or an admiral pie (70 Cooking): the potion is nearer
    const iron = accountWith({
      type: 'iron',
      everySkill: 99,
      levels: { fishing: 57, herblore: 60, cooking: 65 },
      allQuests: true,
    })
    expect(missing(questReadiness(iron, quest('Swan Song')))).toEqual([
      '62 fishing (has 57; Super fishing potion at 62 herblore)',
    ])
  })

  it('never counts a boost toward a level marked not boostable (acceptance F1)', () => {
    // a ranging potion would take 60 Ranged past The Curse of Arrav's 62
    const main = accountWith({ everySkill: 99, levels: { ranged: 60 }, allQuests: true })
    const readiness = questReadiness(main, quest('The Curse of Arrav'))
    expect(readiness.missing).toEqual([
      expect.objectContaining({
        kind: 'skill',
        skill: 'ranged',
        boostable: false,
        nearestBoost: null,
      }),
    ])
  })

  it('counts Kudos from quests, the natural history quiz and cleaning finds (approval 6, acceptance A5)', () => {
    expect(kudosWithinReach(freshAccount())).toBe(0)
    expect(kudosWithinReach(freshAccount({ quests: ['Natural history quiz'] }))).toBe(28)
    expect(kudosWithinReach(freshAccount({ quests: ['The Dig Site'] }))).toBe(50)
    expect(kudosWithinReach(freshAccount({ allQuests: true }))).toBe(158)

    // Bone Voyage needs 100: The Dig Site's 50 and the quiz's 28 leave it 22 short
    const museum = ['The Dig Site', 'Natural history quiz']
    const short = freshAccount({ everySkill: 99, quests: museum })
    expect(missing(questReadiness(short, quest('Bone Voyage')))).toEqual([
      '100 Kudos (78 within reach)',
    ])
    const quests = [
      ...museum,
      'Demon Slayer',
      'Rune Mysteries',
      'Shield of Arrav',
      'Priest in Peril',
      'The Grand Tree',
    ]
    expect(
      questReadiness(freshAccount({ everySkill: 99, quests }), quest('Bone Voyage')).missing,
    ).toEqual([])
  })

  it('never lets an ironman’s need that applies only sometimes stand in the way (acceptance B3)', () => {
    // steel nails only on free-to-play worlds, a karambwan only if the given one burns, an amulet
    // only if made by hand
    const iron = (crafting: number) =>
      accountWith({
        type: 'iron',
        everySkill: 99,
        levels: { smithing: 20, fishing: 50, crafting },
        allQuests: true,
      })
    for (const name of ['Dragon Slayer I', 'Tai Bwo Wannai Trio', 'Making History'])
      expect(questReadiness(iron(20), quest(name)).missing).toEqual([])
    // the unfired bowl applies every time
    expect(missing(questReadiness(iron(7), quest('Dragon Slayer I')))).toEqual([
      'ironman: an unfired bowl, 8 crafting',
    ])
    // and a main never has to make anything
    const main = accountWith({ everySkill: 99, levels: { crafting: 1 }, allQuests: true })
    expect(questReadiness(main, quest('Dragon Slayer I')).missing).toEqual([])
  })

  it('takes either of an ironman’s options', () => {
    // a mithril grapple: 59 Fletching and 59 Smithing to make, or 35 Firemaking
    const iron = (levels: Record<string, number>) =>
      accountWith({ type: 'iron', everySkill: 99, levels, allQuests: true })
    const arrav = quest('The Curse of Arrav')
    expect(
      questReadiness(iron({ fletching: 59, smithing: 59, firemaking: 1 }), arrav).missing,
    ).toEqual([])
    expect(
      questReadiness(iron({ fletching: 1, smithing: 1, firemaking: 35 }), arrav).missing,
    ).toEqual([])
    expect(
      missing(questReadiness(iron({ fletching: 58, smithing: 59, firemaking: 34 }), arrav)),
    ).toEqual(['ironman: a mithril grapple, 59 fletching and 59 smithing or 35 firemaking'])
  })
})

describe('diaryReadiness', () => {
  it('puts every lower tier first, since a tier’s reward needs them claimed (acceptance B4)', () => {
    expect(
      missing(diaryReadiness(freshAccount({ everySkill: 99 }), diary('Kandarin Medium')))[0],
    ).toBe('lower tier Kandarin Easy')
    expect(
      diaryReadiness(freshAccount({ everySkill: 99 }), diary('Kandarin Elite'))
        .missing.filter((gap) => gap.kind === 'lower-tier')
        .map(inWords),
    ).toEqual([
      'lower tier Kandarin Easy',
      'lower tier Kandarin Medium',
      'lower tier Kandarin Hard',
    ])
  })

  it('asks for a partly-done task’s quest finished (decision 4, acceptance F4)', () => {
    const tier = diary('Kourend & Kebos Medium')
    const others = Object.keys(tier.quests).filter((name) => name !== "Eagles' Peak")
    const account = (eagles: 'started' | 'finished') =>
      accountWith({
        everySkill: 99,
        quests: eagles === 'finished' ? [...others, "Eagles' Peak"] : others,
        started: eagles === 'started' ? ["Eagles' Peak"] : [],
        diaries: ['Kourend & Kebos Easy'],
      })
    expect(tier.quests["Eagles' Peak"]).toBe('started')
    expect(missing(diaryReadiness(account('started'), tier))).toEqual(["quest Eagles' Peak"])
    expect(diaryReadiness(account('finished'), tier).missing).toEqual([])
  })

  it('shows the Raiments of the Eye route beside a Runecraft level and never counts it (decision 5, acceptance F5)', () => {
    const account = (runecraft: number) =>
      accountWith({
        everySkill: 99,
        levels: { runecraft },
        allQuests: true,
        diaries: ['Varrock Easy', 'Varrock Medium', 'Varrock Hard'],
      })
    for (const runecraft of [60, 52])
      expect(diaryReadiness(account(runecraft), diary('Varrock Elite')).missing).toEqual([
        expect.objectContaining({
          skill: 'runecraft',
          level: 78,
          raiments: { level: 52, pieces: 2 },
        }),
      ])
  })

  it('meets an either-or need with any one option (acceptance C4)', () => {
    // Karamja Hard: Duradel assigns tasks at 100 combat, or to a Slayer cape wearer
    const choice = diary('Karamja Hard').choices.find((each) => each.note?.startsWith('Duradel'))
    const tier = diaryFactsWith('Karamja Hard', { choices: choice ? [choice] : [] })
    const account = (levels: Record<string, number>) =>
      accountWith({ levels, diaries: ['Karamja Easy', 'Karamja Medium'] })
    expect(missing(diaryReadiness(account({ slayer: 98 }), tier))).toEqual([
      'one of: Duradel assigns tasks at 100 combat, or to a Slayer cape wearer',
    ])
    expect(diaryReadiness(account({ slayer: 99 }), tier).missing).toEqual([])
    const combat = accountWith({ everySkill: 99, diaries: ['Karamja Easy', 'Karamja Medium'] })
    expect(combatLevel(combat)).toBeGreaterThanOrEqual(100)
    expect(diaryReadiness(combat, tier).missing).toEqual([])
  })

  it('counts what it cannot check as met, and a boost toward a boostable option', () => {
    const tier = diaryFactsWith('Karamja Medium', {
      choices: [
        {
          options: [
            [{ kind: 'other', text: 'a cooked oomlie wrap' }],
            [{ kind: 'skill', skill: 'cooking', level: 99, boostable: false }],
          ],
          note: null,
        },
        {
          options: [
            [{ kind: 'skill', skill: 'cooking', level: 50, boostable: true }],
            [{ kind: 'quest', quest: "Legends' Quest", state: 'started' }],
          ],
          note: null,
        },
      ],
    })
    const account = accountWith({ levels: { cooking: 47 }, diaries: ['Karamja Easy'] })
    const readiness = diaryReadiness(account, tier)
    expect(readiness.missing).toEqual([])
    expect(boosted(readiness)).toEqual(["50 cooking (has 47; Chef's delight(m) +4)"])
  })

  it('needs every quest for the quest point cape (acceptance E4)', () => {
    const tier = diaryFactsWith('Lumbridge & Draynor Elite', { allQuests: true })
    const diaries = [
      'Lumbridge & Draynor Easy',
      'Lumbridge & Draynor Medium',
      'Lumbridge & Draynor Hard',
    ]
    // Learning the Ropes, which every account has done, is one of the 184
    expect(missing(diaryReadiness(freshAccount({ diaries }), tier))).toEqual([
      'every quest (183 left)',
    ])
    expect(diaryReadiness(freshAccount({ diaries, allQuests: true }), tier).missing).toEqual([])
  })

  it('asks an ironman for the levels it needs that a main does not', () => {
    const account = (type: 'main' | 'iron') =>
      accountWith({
        type,
        everySkill: 99,
        levels: { hunter: 68 },
        allQuests: true,
        diaries: ['Varrock Easy', 'Varrock Medium'],
      })
    expect(diaryReadiness(account('main'), diary('Varrock Hard')).missing).toEqual([])
    expect(missing(diaryReadiness(account('iron'), diary('Varrock Hard')))).toEqual([
      'ironman: 69 hunter',
    ])
  })

  it('needs the quest points, combat level and Kudos its tasks do', () => {
    const tier = diaryFactsWith('Varrock Hard', { questPoints: 32, combat: 40, kudos: 153 })
    const diaries = ['Varrock Easy', 'Varrock Medium']
    expect(missing(diaryReadiness(freshAccount({ diaries }), tier))).toEqual([
      '32 quest points (has 1)',
      'combat 40 (has 3)',
      '153 Kudos (0 within reach)',
    ])
  })
})

describe('the Optimal quest guides, walked from a fresh account with the app’s rules', () => {
  const main = walkGuide('main')
  const iron = walkGuide('ironman')
  const notReady = (steps: readonly CheckedStep[]) =>
    steps
      .filter(({ readiness }) => readiness.missing.length)
      .map(({ n, name, readiness }) => `${n} ${name}: ${missing(readiness).join('; ')}`)
  const readyWithBoosts = (steps: readonly CheckedStep[]) =>
    steps
      .filter(({ readiness }) => !readiness.missing.length && readiness.boosted.length)
      .map(({ n, name, readiness }) => `${n} ${name}: ${boosted(readiness).join('; ')}`)

  it('has every quest of the main guide ready when reached, up to step 80 (acceptance A1)', () => {
    const early = main.checked.filter(({ n }) => n <= 80)
    expect(early.map(({ name }) => name).slice(0, 10)).toEqual([
      'Learning the Ropes',
      "Cook's Assistant",
      'Sheep Shearer',
      'Misthalin Mystery',
      'Prince Ali Rescue',
      'The Restless Ghost',
      'Rune Mysteries',
      'Imp Catcher',
      "Witch's Potion",
      "Gertrude's Cat",
    ])
    expect(
      early.filter(({ readiness }) => readiness.missing.length || readiness.boosted.length),
    ).toEqual([])
  })

  it('counts the boosts the main guide’s notes plan on, and asks for the levels where none is counted (acceptance A4)', () => {
    expect(readyWithBoosts(main.checked)).toEqual([
      '81 Elemental Workshop II: 20 magic (has 19; Magic potion +4)',
      '95 Watchtower: 40 mining (has 39; Dwarven stout(m) +2)',
      "107 Big Chompy Bird Hunting: 30 cooking (has 28; Chef's delight(m) +3)",
      "174 Eadgar's Ruse: 31 herblore (has 27; Botanical pie +4)",
      '184 Rum Deal: 47 prayer (has 45; Edgeville Monastery and Nature Grotto; altars +2)',
      "193 Heroes' Quest: 53 cooking (has 50; Chef's delight(m) +4); 53 fishing (has 50; Super fishing potion +6)",
      '210 Family Crest: 59 magic (has 55; Magic potion +4)',
      "219 Legends' Quest: 56 magic (has 55; Magic potion +4); 45 herblore (has 41; Botanical pie +4)",
      '237 Kourend & Kebos Medium: 53 hunter (has 50; Super hunter potion +6)',
      '249 Fairytale II - Cure a Queen: 57 herblore (has 55; Botanical pie +4); 49 farming (has 46; Garden pie +3)',
      "251 Recipe for Disaster - King Awowogei: 70 cooking (has 66; Chef's delight(m) +5)",
      '270 Swan Song: 62 fishing (has 57; Super fishing potion +6)',
      '283 Karamja Medium: 65 fishing (has 60; Super fishing potion +6)',
    ])
  })

  it('asks for what the main guide leaves to the player: combat, a started miniquest, a level (acceptance A4, A6)', () => {
    expect(notReady(main.checked)).toEqual([
      '238 Lumbridge & Draynor Medium: combat 70 (has 63)',
      '241 Western Provinces Medium: combat 70 (has 63)',
      // a dragon axe needs 60 Attack, and the route has 52
      '280 Grim Tales: 71 woodcutting (has 68)',
      '281 Dream Mentor: combat 85 (has 71)',
      '315 Dragon Slayer II: quest Barbarian Training (started)',
      '316 The Curse of Arrav: 62 ranged (has 60)',
      '318 Making Friends with My Arm: 72 mining (has 69; Dragon pickaxe at 60 attack)',
    ])
  })

  it('meets every ironman level the ironman guide’s quests force, some exactly (acceptance B2)', () => {
    expect(
      iron.checked
        .flatMap(({ readiness }) => readiness.missing)
        .filter((gap) => gap.kind === 'ironman'),
    ).toEqual([])
    const at = (n: number) => iron.checked.find((step) => step.n === n)
    const isles = at(159)
    expect(isles?.name).toBe('The Fremennik Isles')
    expect([isles?.account.skills.woodcutting.level, isles?.account.skills.crafting.level]).toEqual(
      [56, 46],
    )
    const lament = at(207)
    expect(lament?.name).toBe("Enakhra's Lament")
    expect(lament?.account.skills.mining.level).toBe(45)
  })

  it('claims the easy tiers in one step before the medium tiers that need them (acceptance B4)', () => {
    const easy = iron.checked.filter(({ n }) => n === 226)
    expect(easy.map(({ name }) => name)).toEqual([
      'Fremennik Easy',
      'Kandarin Easy',
      'Kourend & Kebos Easy',
      'Lumbridge & Draynor Easy',
      'Morytania Easy',
      'Western Provinces Easy',
      'Wilderness Easy',
    ])
    expect(easy.filter(({ readiness }) => readiness.missing.length)).toEqual([])
  })

  it('lists where the ironman guide’s own steps fall short (acceptance B5, B6)', () => {
    expect(notReady(iron.checked)).toEqual([
      // open (B5): the pages do not say which of these only finishing needs; the safe reading asks
      '60 Rag and Bone Man II: quest Skippy and the Mogres; quest Creature of Fenkenstrain (started)',
      '99 Ratcatchers: quest The Giant Dwarf (started)',
      // an ironman cannot count a chef's delight, nor an ale
      '244 Recipe for Disaster - King Awowogei: 70 cooking (has 65)',
      '261 Swan Song: 62 fishing (has 57; Super fishing potion at 62 herblore)',
      '266 Dream Mentor: combat 85 (has 69)',
      '270 Western Provinces Medium: combat 70 (has 69)',
      '278 Lumbridge & Draynor Medium: combat 70 (has 69)',
      '297 The Path of Glouphrie: 60 strength (has 53)',
      '315 Making Friends with My Arm: 72 mining (has 70)',
      '325 Dragon Slayer II: quest Barbarian Training (started)',
    ])
    expect(readyWithBoosts(iron.checked)).toEqual([
      '235 Fairytale II - Cure a Queen: 49 farming (has 46; Garden pie +3)',
      '276 Karamja Medium: 65 fishing (has 59; Super fishing potion +6)',
    ])
  })

  it('reaches Recipe for Disaster’s quest points part by part, as the game gives them', () => {
    expect(main.at(300)).toEqual({ questPoints: 298, combat: 72 })
    expect(iron.at(300)).toEqual({ questPoints: 300, combat: 70 })
  })
})

describe('the test fixture', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/account.json', import.meta.url), 'utf8'),
  ) as { state: LegacySaveV1 }
  const account: Account = { ...accountFromSave(migrateLegacySave(fixture.state)), type: 'iron' }

  it('has the quest points, Kudos and combat level the research counted (acceptance C2)', () => {
    // the research's 198 quest points, and 1 for Learning the Ropes, which every account has done
    expect([questPoints(account), kudosWithinReach(account), combatLevel(account)]).toEqual([
      199, 95, 92,
    ])
  })

  it('is ready for four diary tiers, and close to five more (acceptance C4, C5)', () => {
    const unclaimed = DIARY_FACTS.filter(({ name }) => !account.completedDiaries.has(name))
    const ready = unclaimed.filter((tier) => !diaryReadiness(account, tier).missing.length)
    // Fremennik Medium needs Fairytale II started, which the claimed fairy ring tiers prove (C5)
    expect(ready.map(({ name }) => name)).toEqual([
      'Fremennik Medium',
      'Karamja Medium',
      'Morytania Easy',
      'Wilderness Easy',
    ])
    expect(diary('Karamja Medium').longTasks.map(({ text }) => text)).toEqual([
      '100% favour in Tai Bwo Wannai (Tai Bwo Wannai Cleanup)',
    ])
    const close = Object.fromEntries(
      ['Varrock Hard', 'Wilderness Medium', 'Karamja Hard', 'Falador Medium'].map((name) => [
        name,
        missing(diaryReadiness(account, diary(name))),
      ]),
    )
    expect(close).toEqual({
      'Varrock Hard': ['68 farming (has 55)', '153 Kudos (95 within reach)'],
      'Wilderness Medium': ['lower tier Wilderness Easy'],
      'Karamja Hard': [
        'lower tier Karamja Medium',
        'one of: Duradel assigns tasks at 100 combat, or to a Slayer cape wearer',
      ],
      'Falador Medium': ['quest Ratcatchers (started)', 'quest Skippy and the Mogres'],
    })
  })

  it('is ready for the ironman guide’s next quests (acceptance C6)', () => {
    const orders = JSON.parse(
      readFileSync(new URL('../fixtures/quest-orders.json', import.meta.url), 'utf8'),
    ) as { ironman: { steps: { kind: string; quest?: string }[] } }
    const next = orders.ironman.steps
      .flatMap(({ kind, quest: name }) => (kind === 'quest' && name ? [name] : []))
      .filter((name) => !hasCompletedQuest(account, name))
      .slice(0, 12)
    // C6's list without Learning the Ropes, which every account has done, and with the natural
    // history quiz, which the research did not count as a quest step
    expect(next).toEqual([
      'Misthalin Mystery',
      'Pandemonium',
      'Romeo & Juliet',
      'Natural history quiz',
      'Clock Tower',
      'Sheep Herder',
      'Below Ice Mountain',
      'A Ruff Situation',
      'The Ides of Milk',
      'Scorpion Catcher',
      'A Porcine of Interest',
      'The Queen of Thieves',
    ])
    expect(next.filter((name) => questReadiness(account, quest(name)).missing.length)).toEqual([])
  })
})
