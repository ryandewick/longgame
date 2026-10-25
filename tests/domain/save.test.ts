import { describe, expect, it } from 'vitest'
import { forEverySkill, SKILL_KEYS } from '#shared/data/skills'
import {
  SAVE_VERSION,
  SAVED_ACCOUNTS_VERSION,
  accountFromSave,
  blankSave,
  isLegacySave,
  migrateLegacySave,
  migrateLegacySnapshots,
  newAccountSave,
  noSavedAccounts,
  openAccountSave,
  readSave,
  readSavedAccounts,
  savedAccountsFrom,
} from '#shared/domain/save'
import type { LegacyBlock, LegacySaveV1, SavedHiscores, SavedState } from '#shared/domain/save'

/** What the vanilla app's blank() returned. */
const blankLegacySave = (): LegacySaveV1 => ({
  v: 1,
  name: '',
  hs: null,
  ws: null,
  manual: { quests: {}, diaries: {}, allQuests: false, allDiaries: false },
  prefs: {
    mood: 'balanced',
    minutes: 90,
    budget: 'any',
    account: null,
    ticks: false,
    exclude: {},
    dailies: true,
    wildcard: true,
    sort: 'hours',
  },
  session: null,
  resets: {},
  history: [],
  rotation: [],
})

const legacyBlock = (overrides: Partial<LegacyBlock>): LegacyBlock => ({
  kind: 'skill',
  k: 'mining',
  title: 'Iron ore',
  note: 'A note',
  minutes: 40,
  int: 'active',
  want: ['active'],
  xph: 30_000,
  est: false,
  target: 20_000,
  elapsed: 0,
  running: null,
  done: false,
  ...overrides,
})

describe('blankSave', () => {
  it('is the current version with the vanilla app’s defaults', () => {
    expect(blankSave()).toMatchObject({
      version: SAVE_VERSION,
      name: '',
      accountType: null,
      hiscores: null,
      preferences: { mood: 'balanced', minutes: 90, budget: 'any', tickPerfect: false },
    })
  })

  it('is what a blank vanilla save migrates to', () => {
    expect(migrateLegacySave(blankLegacySave())).toEqual(blankSave())
  })

  it('has nothing ticked and nothing declined', () => {
    expect(blankSave()).toMatchObject({
      completedQuests: [],
      completedDiaries: [],
      declinedQuests: [],
      declinedDiaries: [],
    })
  })
})

describe('migrateLegacySave: the account', () => {
  it('carries over the name, account type and preferences', () => {
    const legacy = blankLegacySave()
    legacy.name = 'Zezima'
    legacy.prefs = {
      mood: 'afk',
      minutes: 240,
      budget: 'cheap',
      account: 'iron',
      ticks: true,
      exclude: { slayer: true, agility: false, runecraft: true },
      dailies: false,
      wildcard: false,
      sort: 'name',
    }
    expect(migrateLegacySave(legacy)).toMatchObject({
      name: 'Zezima',
      accountType: 'iron',
      preferences: {
        mood: 'afk',
        minutes: 240,
        budget: 'cheap',
        tickPerfect: true,
        excludedSkills: ['slayer', 'runecraft'],
        includeResets: false,
        includeWildcard: false,
        skillSort: 'name',
      },
    })
  })

  it('fills in what an older save never had', () => {
    const save = migrateLegacySave({ v: 1, name: 'Old', prefs: { mood: 'afk' } })
    expect(save.preferences).toEqual({ ...blankSave().preferences, mood: 'afk' })
    expect(save.history).toEqual([])
    expect(save.session).toBeNull()
  })

  it('carries over the hiscores, with level 1 for a skill the save does not have', () => {
    const legacy = blankLegacySave()
    legacy.hs = {
      fetched: 1_700_000_000_000,
      skills: {
        mining: { n: 'Mining', level: 72, xp: 900_000, rank: 5 },
        fishing: { n: 'Fishing', level: 50, xp: 101_333 },
      },
      total: { level: 144, xp: 1_001_333 },
    }
    const { hiscores } = migrateLegacySave(legacy)
    expect(hiscores?.fetchedAt).toBe(1_700_000_000_000)
    expect(hiscores?.skills.mining).toEqual({ level: 72, xp: 900_000 })
    expect(hiscores?.skills.sailing).toEqual({ level: 1, xp: 0 })
    expect(Object.keys(hiscores?.skills ?? {})).toEqual([...SKILL_KEYS])
    expect(hiscores).toMatchObject({ totalLevel: 144, totalXp: 1_001_333 })
  })

  it('drops a skill this app does not know', () => {
    const legacy = blankLegacySave()
    legacy.hs = { fetched: 1, skills: { dungeoneering: { level: 80, xp: 2_000_000 } } }
    legacy.prefs = { ...legacy.prefs, exclude: { dungeoneering: true } }
    legacy.rotation = ['dungeoneering', 'mining']
    const save = migrateLegacySave(legacy)
    expect(Object.keys(save.hiscores?.skills ?? {})).not.toContain('dungeoneering')
    expect(save.preferences.excludedSkills).toEqual([])
    expect(save.recentSkills).toEqual(['mining'])
  })

  it('carries over the quests and diaries ticked by hand', () => {
    const legacy = blankLegacySave()
    legacy.manual = {
      quests: { 'Bone Voyage': true, "Cook's Assistant": true, 'Dragon Slayer I': false },
      diaries: { 'Ardougne Medium': true },
      allQuests: false,
      allDiaries: true,
    }
    expect(migrateLegacySave(legacy)).toMatchObject({
      completedQuests: ['Bone Voyage', "Cook's Assistant"],
      completedDiaries: ['Ardougne Medium'],
      allQuests: false,
      allDiaries: true,
    })
  })

  it('turns quests WikiSync had read into ticks, in the spelling the data uses', () => {
    const legacy = blankLegacySave()
    legacy.manual = { quests: { 'Bone Voyage': true } }
    legacy.ws = { quests: { 'Bone Voyage': 2, 'Cook’s Assistant': 2, 'Dragon Slayer I': 1 } }
    expect(migrateLegacySave(legacy).completedQuests).toEqual(['Bone Voyage', "Cook's Assistant"])
  })

  it('keeps the quests WikiSync had read as started, where the start matters to something', () => {
    const legacy = blankLegacySave()
    legacy.manual = { quests: { 'The Giant Dwarf': true } }
    legacy.ws = {
      quests: {
        'Dragon Slayer I': 1,
        'Fairytale II - Cure a Queen': 1,
        // nothing needs Cook's Assistant only started; The Giant Dwarf is ticked done by hand
        'Cook’s Assistant': 1,
        'The Giant Dwarf': 1,
        'Plague City': 0,
      },
    }
    expect(migrateLegacySave(legacy).startedQuests).toEqual([
      'Dragon Slayer I',
      'Fairytale II - Cure a Queen',
    ])
  })

  it('turns diaries WikiSync had read into ticks, under the names requirements use', () => {
    const legacy = blankLegacySave()
    legacy.ws = {
      achievement_diaries: {
        Ardougne: { Easy: { complete: true }, Medium: { complete: false } },
        'Kourend and Kebos': { Easy: { complete: true } },
      },
    }
    const { completedDiaries } = migrateLegacySave(legacy)
    expect(completedDiaries).toContain('Ardougne Easy')
    expect(completedDiaries).toContain('Kourend & Kebos Easy')
    expect(completedDiaries).not.toContain('Ardougne Medium')
  })

  it('carries over when each reset was last done and the recent skills', () => {
    const legacy = blankLegacySave()
    legacy.resets = { herb: 123, birdhouse: 456 }
    legacy.rotation = ['mining', 'fishing']
    expect(migrateLegacySave(legacy)).toMatchObject({
      resetLog: { herb: 123, birdhouse: 456 },
      recentSkills: ['mining', 'fishing'],
    })
  })
})

describe('migrateLegacySave: the session', () => {
  const sessionWith = (blocks: LegacyBlock[], mood = 'balanced'): LegacySaveV1 => ({
    ...blankLegacySave(),
    prefs: { mood },
    session: {
      t0: 1_000,
      minutes: 90,
      blocks,
      startSnap: { mining: 5_000 },
      ended: null,
      gains: null,
    },
  })

  it('carries over a session in progress, timers and all', () => {
    const legacy = sessionWith([
      legacyBlock({
        kind: 'reset',
        k: 'herb',
        title: 'Herb run',
        minutes: 5,
        int: 'reset',
        skill: 'farming',
        done: true,
      }),
      legacyBlock({ elapsed: 60_000, running: 2_000, est: true }),
      legacyBlock({ kind: 'wild', k: undefined, title: 'Clue scroll', minutes: 15, int: 'wild' }),
    ])
    const { session } = migrateLegacySave(legacy)
    expect(session).toMatchObject({ startedAt: 1_000, minutes: 90, endedAt: null, tally: null })
    expect(session?.startingXp.mining).toBe(5_000)
    expect(session?.startingXp.fishing).toBe(0)
    expect(session?.blocks).toEqual([
      {
        kind: 'reset',
        resetKey: 'herb',
        title: 'Herb run',
        note: 'A note',
        minutes: 5,
        skill: 'farming',
        elapsed: 0,
        runningSince: null,
        done: true,
      },
      {
        kind: 'skill',
        skill: 'mining',
        title: 'Iron ore',
        note: 'A note',
        minutes: 40,
        intensity: 'active',
        wanted: ['active'],
        xpPerHour: 30_000,
        rateIsEstimate: true,
        targetXp: 20_000,
        elapsed: 60_000,
        runningSince: 2_000,
        done: false,
      },
      {
        kind: 'wildcard',
        title: 'Clue scroll',
        note: 'A note',
        minutes: 15,
        elapsed: 0,
        runningSince: null,
        done: false,
      },
    ])
  })

  it('gives a block dealt before moods were strict the intensities a swap should respect', () => {
    const block = legacyBlock({ want: undefined, int: 'semi' })
    const wantedUnder = (mood: string) => {
      const [migrated] = migrateLegacySave(sessionWith([block], mood)).session?.blocks ?? []
      return migrated?.kind === 'skill' ? migrated.wanted : null
    }
    expect(wantedUnder('afk')).toEqual(['afk'])
    expect(wantedUnder('active')).toEqual(['active'])
    expect(wantedUnder('balanced')).toEqual(['semi'])
  })

  it('drops a block for a skill this app does not know', () => {
    const legacy = sessionWith([legacyBlock({ k: 'dungeoneering' }), legacyBlock({})])
    expect(migrateLegacySave(legacy).session?.blocks).toHaveLength(1)
  })

  it('carries over a finished session with its tally', () => {
    const legacy = sessionWith([legacyBlock({ done: true })])
    legacy.session = {
      ...legacy.session,
      t0: 1_000,
      minutes: 90,
      blocks: legacy.session?.blocks ?? [],
      ended: 9_000,
      gains: { mining: 12_000 },
      total: 12_000,
      levels: { mining: 2 },
    }
    expect(migrateLegacySave(legacy).session).toMatchObject({
      endedAt: 9_000,
      tally: { gains: { mining: 12_000 }, totalXp: 12_000, levels: { mining: 2 } },
    })
  })
})

describe('migrateLegacySave: the history', () => {
  it('carries over finished sessions in the same order', () => {
    const legacy = blankLegacySave()
    legacy.history = [
      {
        t: 2_000,
        minutes: 60,
        elapsed: 3_500_000,
        gains: { ranged: 20_000, crafting: 120_000 },
        total: 140_000,
        levels: { ranged: 1 },
        blocks: [
          { kind: 'reset', k: 'birdhouse', title: 'Birdhouse run', done: true },
          { kind: 'skill', k: 'crafting', title: 'Glassblowing', done: true },
          { kind: 'wild', title: 'Clue scroll', done: false },
        ],
      },
      { t: 1_000, minutes: 30 },
    ]
    expect(migrateLegacySave(legacy).history).toEqual([
      {
        endedAt: 2_000,
        minutes: 60,
        elapsed: 3_500_000,
        gains: { ranged: 20_000, crafting: 120_000 },
        totalXp: 140_000,
        levels: { ranged: 1 },
        blocks: [
          { kind: 'reset', resetKey: 'birdhouse', title: 'Birdhouse run', done: true },
          { kind: 'skill', skill: 'crafting', title: 'Glassblowing', done: true },
          { kind: 'wildcard', title: 'Clue scroll', done: false },
        ],
      },
      { endedAt: 1_000, minutes: 30, elapsed: 0, gains: {}, totalXp: 0, levels: {}, blocks: [] },
    ])
  })
})

describe('migrateLegacySnapshots', () => {
  it('renames the fields and keeps the order', () => {
    const snapshots = migrateLegacySnapshots([
      { t: 1_000, skills: { mining: 500, dungeoneering: 9 }, total: 500 },
      { t: 2_000, skills: { mining: 900 } },
    ])
    expect(snapshots).toEqual([
      { takenAt: 1_000, skills: { mining: 500 }, totalXp: 500 },
      { takenAt: 2_000, skills: { mining: 900 }, totalXp: 0 },
    ])
  })
})

describe('accountFromSave', () => {
  it('reads a level 1 main out of a blank save', () => {
    const account = accountFromSave(blankSave())
    expect(account.type).toBe('main')
    expect(account.skills.mining).toEqual({ level: 1, xp: 0 })
    expect(account.completedQuests.size).toBe(0)
    expect(account.preferences.excludedSkills.size).toBe(0)
  })

  it('turns the saved lists into sets and carries the rest across', () => {
    const save = migrateLegacySave({
      ...blankLegacySave(),
      hs: { fetched: 1, skills: { mining: { level: 72, xp: 900_000 } } },
      manual: {
        quests: { 'Bone Voyage': true },
        diaries: { 'Ardougne Medium': true },
        allQuests: true,
      },
      prefs: { account: 'iron', budget: 'cheap', ticks: true, exclude: { slayer: true } },
    })
    const account = accountFromSave(save)
    expect(account.type).toBe('iron')
    expect(account.skills.mining).toEqual({ level: 72, xp: 900_000 })
    expect(account.completedQuests.has('Bone Voyage')).toBe(true)
    expect(account.completedDiaries.has('Ardougne Medium')).toBe(true)
    expect(account.allQuests).toBe(true)
    expect(account.allDiaries).toBe(false)
    expect(account.preferences.budget).toBe('cheap')
    expect(account.preferences.tickPerfect).toBe(true)
    expect([...account.preferences.excludedSkills]).toEqual(['slayer'])
  })
})

describe('accountFromSave: what the ticks prove', () => {
  it('reads every quest and tier the ticks prove, not only the ones ticked', () => {
    const account = accountFromSave({
      ...blankSave(),
      completedQuests: ['Creature of Fenkenstrain'],
      completedDiaries: ['Kandarin Easy'],
    })
    expect(account.completedQuests.has('Priest in Peril')).toBe(true)
    expect([...account.startedQuests].sort()).toEqual([
      'Elemental Workshop I',
      'The Restless Ghost',
    ])
  })

  it('counts every tier as claimed, with what it proves, under the diary cape shortcut', () => {
    const account = accountFromSave({ ...blankSave(), allDiaries: true })
    expect(account.completedDiaries.size).toBe(48)
    expect(account.startedQuests.has('Fairytale II - Cure a Queen')).toBe(true)
  })
})

describe('readSave', () => {
  it('migrates a vanilla save', () => {
    const legacy = { ...blankLegacySave(), name: 'Zezima' }
    expect(isLegacySave(legacy)).toBe(true)
    expect(readSave(legacy)).toEqual({ ...blankSave(), name: 'Zezima' })
  })

  it('survives the trip through JSON', () => {
    const save = { ...blankSave(), name: 'Zezima', completedQuests: ['Bone Voyage'] }
    expect(readSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('keeps the quests and diary tiers answered "not yet"', () => {
    const save = {
      ...blankSave(),
      declinedQuests: ['Sins of the Father'],
      declinedDiaries: ['Desert Hard'],
    }
    expect(readSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('reads a version 2 save written before answers were kept as one with nothing declined', () => {
    const { declinedQuests, declinedDiaries, startedQuests, ...older } = {
      ...blankSave(),
      name: 'Zezima',
      completedQuests: ['Bone Voyage'],
    }
    expect(declinedQuests).toEqual([])
    expect(declinedDiaries).toEqual([])
    expect(startedQuests).toEqual([])
    expect(older).not.toHaveProperty('declinedQuests')
    expect(older.version).toBe(SAVE_VERSION)

    expect(readSave(JSON.parse(JSON.stringify(older)))).toEqual({
      ...older,
      startedQuests: [],
      declinedQuests: [],
      declinedDiaries: [],
    })
  })

  it('keeps the quests started', () => {
    const save = { ...blankSave(), startedQuests: ['Fairytale II - Cure a Queen'] }
    expect(readSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('reads a version 2 save written before quest steps as one with them on, as a new save has them', () => {
    const blank = blankSave()
    expect(blank.preferences.includeQuestStep).toBe(true)
    const { includeQuestStep, ...olderPreferences } = blank.preferences
    expect(includeQuestStep).toBe(true)
    const older = { ...blank, name: 'Zezima', preferences: olderPreferences }
    expect(readSave(JSON.parse(JSON.stringify(older)))).toEqual({ ...blank, name: 'Zezima' })
  })

  it('keeps quest steps switched off, and a session that ends on one', () => {
    const save = {
      ...blankSave(),
      preferences: { ...blankSave().preferences, includeQuestStep: false },
      session: {
        startedAt: 1_800_000_000_000,
        minutes: 120,
        blocks: [
          {
            kind: 'quest' as const,
            title: "Twilight's Promise",
            step: 'finish' as const,
            minutes: 40,
            reason: {
              kind: 'saves' as const,
              quest: 'Perilous Moons',
              hours: 33,
              opens: ['Sulphur naguas'],
              between: 0,
            },
            elapsed: 0,
            runningSince: null,
            done: false,
          },
        ],
        startingXp: Object.fromEntries(SKILL_KEYS.map((skill) => [skill, 0])),
        endedAt: null,
        tally: null,
      },
    }
    expect(readSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('declines nothing in a vanilla save, which never asked', () => {
    const save = readSave({ ...blankLegacySave(), manual: { quests: { 'Bone Voyage': true } } })
    expect(save).toMatchObject({
      completedQuests: ['Bone Voyage'],
      declinedQuests: [],
      declinedDiaries: [],
    })
  })

  it.each([
    ['nothing', null],
    ['text', 'longgame'],
    ['an object with no version', { name: 'Zezima' }],
    ['a version from the future', { version: SAVE_VERSION + 1 }],
    ['an unknown old version', { v: 0 }],
  ])('does not accept %s', (_case, value) => {
    expect(readSave(value)).toBeNull()
  })
})

/** Stats as a lookup gives them: every skill at one level. */
function statsAt(level: number): SavedHiscores {
  return {
    fetchedAt: 1_800_000_000_000,
    skills: forEverySkill(() => ({ level, xp: 0 })),
    totalLevel: level * SKILL_KEYS.length,
    totalXp: 0,
  }
}

/** An account's save with a name, stats and a little of everything an account keeps. */
function accountSave(name: string, level: number): SavedState {
  return {
    ...newAccountSave(name, statsAt(level), 'main'),
    completedQuests: ['Bone Voyage'],
    declinedQuests: ['Sins of the Father'],
    preferences: { ...blankSave().preferences, mood: 'afk', minutes: 60 },
    resetLog: { birdhouses: 1_800_000_000_000 },
  }
}

describe('newAccountSave', () => {
  it('is a blank save with the name, the stats and the type it was looked up with', () => {
    const stats = statsAt(50)
    expect(newAccountSave('Zezima', stats, 'iron')).toEqual({
      ...blankSave(),
      name: 'Zezima',
      hiscores: stats,
      accountType: 'iron',
    })
  })
})

describe('savedAccountsFrom: the save of a version that kept one account', () => {
  it('makes it the first and only account, open, exactly as it was', () => {
    const save = accountSave('Zezima', 70)
    const saved = savedAccountsFrom(save)
    expect(saved).toEqual({ version: SAVED_ACCOUNTS_VERSION, open: 'Zezima', accounts: [save] })
    expect(saved.accounts[0]).toBe(save)
  })

  it('keeps a name that never loaded as the open account, with its ticks', () => {
    const save = { ...blankSave(), name: 'Zezlma', completedQuests: ['Bone Voyage'] }
    expect(savedAccountsFrom(save)).toEqual({
      version: SAVED_ACCOUNTS_VERSION,
      open: 'Zezlma',
      accounts: [save],
    })
  })

  it('keeps anything an account fills in, even without a name', () => {
    const save = { ...blankSave(), completedDiaries: ['Ardougne Easy'] }
    expect(savedAccountsFrom(save).accounts).toEqual([save])
  })

  it('makes a save that holds no account no accounts', () => {
    expect(savedAccountsFrom(blankSave())).toEqual(noSavedAccounts())
    // nothing changes preferences without an account, so preferences alone are not one
    const preferencesOnly = {
      ...blankSave(),
      preferences: { ...blankSave().preferences, minutes: 30 },
    }
    expect(savedAccountsFrom(preferencesOnly)).toEqual(noSavedAccounts())
  })
})

describe('readSavedAccounts', () => {
  it('reads a version 3 save back as it was written', () => {
    const saved = {
      version: SAVED_ACCOUNTS_VERSION,
      open: 'Lynx Titan',
      accounts: [accountSave('Zezima', 70), accountSave('Lynx Titan', 99)],
    }
    expect(readSavedAccounts(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('brings a version 2 save in as the first account, open', () => {
    const save = accountSave('Zezima', 70)
    expect(readSavedAccounts(JSON.parse(JSON.stringify(save)))).toEqual({
      version: SAVED_ACCOUNTS_VERSION,
      open: 'Zezima',
      accounts: [save],
    })
  })

  it('brings a version 1 save in as the first account, by way of version 2', () => {
    const legacy: LegacySaveV1 = {
      ...blankLegacySave(),
      name: 'Zezima',
      manual: { quests: { 'Bone Voyage': true } },
    }
    expect(readSavedAccounts(legacy)).toEqual({
      version: SAVED_ACCOUNTS_VERSION,
      open: 'Zezima',
      accounts: [migrateLegacySave(legacy)],
    })
  })

  it('reads a blank version 2 save, as a first visit leaves it, as no accounts', () => {
    expect(readSavedAccounts(JSON.parse(JSON.stringify(blankSave())))).toEqual(noSavedAccounts())
  })

  it('keeps no accounts as no accounts, so a forgotten last account stays forgotten', () => {
    expect(readSavedAccounts(JSON.parse(JSON.stringify(noSavedAccounts())))).toEqual(
      noSavedAccounts(),
    )
  })

  it('fills in what an account written before a field was added lacks', () => {
    const { declinedQuests, declinedDiaries, startedQuests, ...older } = accountSave('Zezima', 70)
    expect([declinedQuests, declinedDiaries, startedQuests]).toEqual([
      ['Sins of the Father'],
      [],
      [],
    ])
    const saved = { version: SAVED_ACCOUNTS_VERSION, open: 'Zezima', accounts: [older] }
    expect(readSavedAccounts(JSON.parse(JSON.stringify(saved)))?.accounts).toEqual([
      { ...older, startedQuests: [], declinedQuests: [], declinedDiaries: [] },
    ])
  })

  it('opens the first account when the open name is not in the list', () => {
    const saved = {
      version: SAVED_ACCOUNTS_VERSION,
      open: 'Nobody',
      accounts: [accountSave('Zezima', 70), accountSave('Lynx Titan', 99)],
    }
    expect(readSavedAccounts(saved)?.open).toBe('Zezima')
    expect(readSavedAccounts({ ...saved, open: null })?.open).toBe('Zezima')
    expect(readSavedAccounts({ ...saved, accounts: [] })?.open).toBeNull()
  })

  it('leaves out an account that does not read, and keeps the first of two with the same name', () => {
    const zezima = accountSave('Zezima', 70)
    const lynx = accountSave('Lynx Titan', 99)
    const saved = {
      version: SAVED_ACCOUNTS_VERSION,
      open: 'Zezima',
      accounts: [zezima, { version: 9 }, 'text', { ...accountSave('ZEZIMA', 20) }, lynx],
    }
    expect(readSavedAccounts(saved)?.accounts).toEqual([zezima, lynx])
  })

  it.each([
    ['nothing', null],
    ['text', 'longgame'],
    ['an object with no version', { name: 'Zezima' }],
    ['version 3 with no list of accounts', { version: SAVED_ACCOUNTS_VERSION }],
    ['a version from the future', { version: SAVED_ACCOUNTS_VERSION + 1, accounts: [] }],
  ])('does not accept %s', (_case, value) => {
    expect(readSavedAccounts(value)).toBeNull()
  })
})

describe('openAccountSave', () => {
  it('is the save of the account named open, or null when there are none', () => {
    const zezima = accountSave('Zezima', 70)
    const lynx = accountSave('Lynx Titan', 99)
    expect(
      openAccountSave({
        version: SAVED_ACCOUNTS_VERSION,
        open: 'Lynx Titan',
        accounts: [zezima, lynx],
      }),
    ).toBe(lynx)
    expect(openAccountSave(noSavedAccounts())).toBeNull()
  })
})
