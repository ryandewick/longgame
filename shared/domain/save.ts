import type { Account, AccountType, Budget } from '../types/account'
import type { Intensity } from '../types/method'
import type {
  HistoryBlock,
  HistoryEntry,
  Mood,
  Session,
  SessionBlock,
  SessionTally,
} from '../types/session'
import type { SkillKey, SkillStat } from '../types/skill'
import type { XpSnapshot } from '../types/snapshot'
import { forEverySkill, isSkillKey } from '../data/skills'
import { blankAccount } from './account'
import { isSameName } from './player-names'
import { provenProgress, startedMatters } from './quest-proof'
import type { ResetLog } from './resets'

/*
 * What is kept between visits. The format is versioned: version 1 is the vanilla app's own
 * state object, version 2 is one account's save as this app writes it, and version 3 is every
 * account the player keeps, each a version 2 save. Old saves are never thrown away, only migrated.
 */

/** The version of one account's save, which is also how an account is exported. */
export const SAVE_VERSION = 2

/** The version of the save that keeps every account: what this app writes. */
export const SAVED_ACCOUNTS_VERSION = 3

/** How the Skills page is ordered. */
export type SkillSort = 'hours' | 'level' | 'name'

/** The hiscores as last fetched. */
export interface SavedHiscores {
  readonly fetchedAt: number
  readonly skills: Readonly<Record<SkillKey, SkillStat>>
  readonly totalLevel: number
  readonly totalXp: number
}

export interface SavedPreferences {
  readonly mood: Mood
  /** The session length last chosen. */
  readonly minutes: number
  readonly budget: Budget
  readonly tickPerfect: boolean
  readonly excludedSkills: readonly SkillKey[]
  /** Slot due resets into a session. */
  readonly includeResets: boolean
  /** End long sessions on a wildcard. */
  readonly includeWildcard: boolean
  /**
   * End a session on a quest or diary step from the Quests page's Next, in the wildcard's place,
   * when one fits. Added after version 2 was first written: a save without it reads as on.
   */
  readonly includeQuestStep: boolean
  readonly skillSort: SkillSort
}

/**
 * Version 2: everything kept about one account, as plain JSON (lists, not sets). It was the whole
 * save while the app kept a single account; now each account in version 3 is one.
 */
export interface SavedState {
  readonly version: 2
  /** The player's name on the hiscores; empty until they give one. */
  readonly name: string
  /** Null until the lookup has said whether the account is an ironman. */
  readonly accountType: AccountType | null
  readonly hiscores: SavedHiscores | null
  readonly completedQuests: readonly string[]
  /**
   * Quests started and not finished, only ever ones whose start matters to something (Fairytale II,
   * for the fairy rings). Added after version 2 was first written: a save without it reads as
   * none started.
   */
  readonly startedQuests: readonly string[]
  readonly completedDiaries: readonly string[]
  /**
   * Quests and diary tiers the player has said are not done yet, so they are not asked about
   * again. Added after version 2 was first written: a save without them reads as none declined.
   */
  readonly declinedQuests: readonly string[]
  readonly declinedDiaries: readonly string[]
  readonly allQuests: boolean
  readonly allDiaries: boolean
  readonly preferences: SavedPreferences
  readonly session: Session | null
  readonly resetLog: ResetLog
  /** Finished sessions, newest first. */
  readonly history: readonly HistoryEntry[]
  /** The skills dealt lately, oldest first, so the next deal can avoid them. */
  readonly recentSkills: readonly SkillKey[]
}

/** The fields a version 2 save may lack, because they were added after the first ones were written. */
type AddedSinceVersionTwo = Pick<SavedState, 'declinedQuests' | 'declinedDiaries' | 'startedQuests'>
/** The preferences a version 2 save may lack, for the same reason. */
type PreferencesAddedSinceVersionTwo = Pick<SavedPreferences, 'includeQuestStep'>

/** A version 2 save as it may have been written, before the fields added since. */
type SavedSinceVersionTwo = Omit<SavedState, keyof AddedSinceVersionTwo | 'preferences'> &
  Partial<AddedSinceVersionTwo> & {
    readonly preferences: Omit<SavedPreferences, keyof PreferencesAddedSinceVersionTwo> &
      Partial<PreferencesAddedSinceVersionTwo>
  }

/** A save for someone who has never used the app. */
export function blankSave(): SavedState {
  return {
    version: SAVE_VERSION,
    name: '',
    accountType: null,
    hiscores: null,
    completedQuests: [],
    startedQuests: [],
    completedDiaries: [],
    declinedQuests: [],
    declinedDiaries: [],
    allQuests: false,
    allDiaries: false,
    preferences: {
      mood: 'balanced',
      minutes: 90,
      budget: 'any',
      tickPerfect: false,
      excludedSkills: [],
      includeResets: true,
      includeWildcard: true,
      includeQuestStep: true,
      skillSort: 'hours',
    },
    session: null,
    resetLog: {},
    history: [],
    recentSkills: [],
  }
}

/**
 * A new account's save: the name it was added under, its stats and type as they were looked up,
 * and nothing else yet, so it starts with nothing ticked and the default preferences.
 */
export function newAccountSave(
  name: string,
  hiscores: SavedHiscores,
  accountType: AccountType | null,
): SavedState {
  // Not a spread of blankSave(): the server build folds the call into the object literal, which
  // then holds these three keys twice, and the Worker's bundler warns about it on every deploy.
  return Object.assign(blankSave(), { name, hiscores, accountType })
}

/**
 * Version 3: every account the player keeps, in the order they were added, and which one is
 * open. Each account is a version 2 save exactly as the app wrote one when it kept a single
 * account, so such a save becomes the first account as it is, and an account can be lifted out
 * as it is, which is what Export does.
 */
export interface SavedAccounts {
  readonly version: typeof SAVED_ACCOUNTS_VERSION
  /** The open account's name, as its save spells it; null when there are no accounts. */
  readonly open: string | null
  /** Every account, in the order they were added. No two share a name (see `isSameName`). */
  readonly accounts: readonly SavedState[]
}

/** The saved accounts of someone who has never used the app, or who has forgotten every account. */
export function noSavedAccounts(): SavedAccounts {
  return { version: SAVED_ACCOUNTS_VERSION, open: null, accounts: [] }
}

/**
 * Does a save hold anything of an account? Only an account fills in a name, stats, ticks, a
 * session, a history or a reset log. A save with none of them is the blank save (a first visit, or
 * an account that was forgotten), whose preferences can only be the defaults, since nothing
 * changes them without an account.
 */
function holdsAnAccount(save: SavedState): boolean {
  return (
    save.name !== '' ||
    save.hiscores !== null ||
    save.accountType !== null ||
    save.completedQuests.length > 0 ||
    save.startedQuests.length > 0 ||
    save.completedDiaries.length > 0 ||
    save.declinedQuests.length > 0 ||
    save.declinedDiaries.length > 0 ||
    save.allQuests ||
    save.allDiaries ||
    save.session !== null ||
    save.history.length > 0 ||
    save.recentSkills.length > 0 ||
    Object.keys(save.resetLog).length > 0
  )
}

/**
 * What a save from a version that kept a single account becomes: that account as the first and
 * only one, open, exactly as it was. A save that held no account becomes no accounts.
 */
export function savedAccountsFrom(save: SavedState): SavedAccounts {
  if (!holdsAnAccount(save)) return noSavedAccounts()
  return { version: SAVED_ACCOUNTS_VERSION, open: save.name, accounts: [save] }
}

/** The open account's save; null when there are no accounts. */
export function openAccountSave(saved: SavedAccounts): SavedState | null {
  return saved.accounts.find((save) => save.name === saved.open) ?? null
}

/** Is this parsed JSON shaped like a version 3 save? */
function isSavedAccounts(
  value: unknown,
): value is { version: 3; open?: unknown; accounts: readonly unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === SAVED_ACCOUNTS_VERSION &&
    'accounts' in value &&
    Array.isArray(value.accounts)
  )
}

/**
 * Reads whatever was saved, whichever version wrote it: a version 3 save, each of its accounts
 * read as a version 2 save is (`readSave` fills in what one written before a field was added
 * lacks), or the save of a version that kept a single account, as that account. Null when it is
 * none of them, in which case the caller starts from `noSavedAccounts()`.
 *
 * Only a file edited by hand could hold an account that does not read, or two with the same name:
 * the first is left out, and of the second only the first is kept. An open name that is not in the
 * list opens the first account.
 */
export function readSavedAccounts(value: unknown): SavedAccounts | null {
  if (!isSavedAccounts(value)) {
    const single = readSave(value)
    return single && savedAccountsFrom(single)
  }
  const accounts: SavedState[] = []
  for (const entry of value.accounts) {
    const save = readSave(entry)
    if (save && !accounts.some((kept) => isSameName(kept.name, save.name))) accounts.push(save)
  }
  const named = accounts.find((save) => save.name === value.open)
  return {
    version: SAVED_ACCOUNTS_VERSION,
    open: (named ?? accounts[0])?.name ?? null,
    accounts,
  }
}

/**
 * The account the rules work on, read out of a save. Its quests and tiers are everything the
 * ticks prove (quest-proof.ts), so a save from before a rule was written gains what it proves; the
 * diary cape shortcut proves what every tier would.
 */
export function accountFromSave(save: SavedState): Account {
  const proven = provenProgress(save, save.allDiaries)
  return {
    // until the lookup says otherwise an account is treated as a main, which hides nothing
    type: save.accountType ?? 'main',
    skills: save.hiscores?.skills ?? blankAccount().skills,
    completedQuests: proven.completedQuests,
    startedQuests: proven.startedQuests,
    completedDiaries: proven.completedDiaries,
    allQuests: save.allQuests,
    allDiaries: save.allDiaries,
    preferences: {
      budget: save.preferences.budget,
      tickPerfect: save.preferences.tickPerfect,
      excludedSkills: new Set(save.preferences.excludedSkills),
    },
  }
}

/*
 * Version 1. Field names are the vanilla app's and are kept exactly, because this describes
 * files that already exist. Fields added late in its life are optional: older saves lack them.
 */

export interface LegacySkillStat {
  /** The skill's display name. */
  n?: string
  level: number
  xp: number
  rank?: number
}

export interface LegacyHiscores {
  fetched: number
  skills: Record<string, LegacySkillStat>
  total?: { level: number; xp: number }
}

/** Quest and diary progress from the private WikiSync add-on that one local copy had. */
export interface LegacyWikiSync {
  /** Quest name to state: 0 is not started, 1 is started, 2 is complete. */
  quests?: Record<string, number>
  /** Region to tier to progress. */
  achievement_diaries?: Record<string, Record<string, { complete?: boolean }>>
}

export interface LegacyBlock {
  kind: 'skill' | 'reset' | 'wild'
  /** A skill key for a skill block, a reset key for a reset block. */
  k?: string
  title: string
  note?: string
  minutes: number
  /** An intensity, or 'reset' or 'wild'. */
  int?: string
  /** The intensities the slot was dealt for; blocks dealt before moods were strict have none. */
  want?: string[]
  xph?: number
  est?: boolean
  target?: number
  /** The skill a reset block trains. */
  skill?: string
  elapsed?: number
  running?: number | null
  done?: boolean
}

export interface LegacySession {
  t0: number
  minutes: number
  blocks: LegacyBlock[]
  startSnap?: Record<string, number>
  ended?: number | null
  gains?: Record<string, number> | null
  total?: number
  levels?: Record<string, number>
}

export interface LegacyHistoryEntry {
  t: number
  minutes: number
  elapsed?: number
  gains?: Record<string, number>
  total?: number
  levels?: Record<string, number>
  blocks?: { kind: string; k?: string; title: string; done?: boolean }[]
}

export interface LegacySaveV1 {
  v: 1
  name?: string
  hs?: LegacyHiscores | null
  ws?: LegacyWikiSync | null
  manual?: {
    quests?: Record<string, boolean>
    diaries?: Record<string, boolean>
    allQuests?: boolean
    allDiaries?: boolean
  }
  prefs?: {
    mood?: string
    minutes?: number
    budget?: string
    account?: string | null
    ticks?: boolean
    exclude?: Record<string, boolean>
    dailies?: boolean
    wildcard?: boolean
    sort?: string
  }
  session?: LegacySession | null
  resets?: Record<string, number>
  history?: LegacyHistoryEntry[]
  rotation?: string[]
}

/** A version 1 XP snapshot. */
export interface LegacySnapshot {
  t: number
  skills: Record<string, number>
  total?: number
}

/** Is this parsed JSON a save from the vanilla app? */
export function isLegacySave(value: unknown): value is LegacySaveV1 {
  return typeof value === 'object' && value !== null && 'v' in value && value.v === 1
}

const INTENSITIES: readonly Intensity[] = ['afk', 'semi', 'active']
const isIntensity = (value: string | undefined): value is Intensity =>
  INTENSITIES.some((intensity) => intensity === value)
const isMood = (value: string | undefined): value is Mood =>
  value === 'balanced' || value === 'afk' || value === 'active'
const isSkillSort = (value: string | undefined): value is SkillSort =>
  value === 'hours' || value === 'level' || value === 'name'

/** The names in a `{ name: true }` tick list that are ticked. */
const tickedNames = (ticks: Record<string, boolean> | undefined): string[] =>
  Object.entries(ticks ?? {})
    .filter(([, ticked]) => ticked)
    .map(([name]) => name)

/** Keeps the entries whose key is a skill this app knows. */
function bySkill(
  values: Record<string, number> | null | undefined,
): Partial<Record<SkillKey, number>> {
  const known: Partial<Record<SkillKey, number>> = {}
  for (const [skill, value] of Object.entries(values ?? {})) {
    if (isSkillKey(skill)) known[skill] = value
  }
  return known
}

/** WikiSync writes some quest names with a curly apostrophe; the data uses straight ones. */
const straightenApostrophes = (name: string): string => name.replaceAll('’', "'")

/** The quests WikiSync had read in one state, under the data's names. */
function syncedQuests(legacy: LegacySaveV1, wanted: number): string[] {
  return Object.entries(legacy.ws?.quests ?? {})
    .filter(([, state]) => state === wanted)
    .map(([name]) => straightenApostrophes(name))
}

function completedQuests(legacy: LegacySaveV1): string[] {
  return [...new Set([...tickedNames(legacy.manual?.quests), ...syncedQuests(legacy, 2)])]
}

/** The quests WikiSync had read as started, where the start matters and nothing ticked them done. */
function startedQuests(legacy: LegacySaveV1, completed: readonly string[]): string[] {
  return syncedQuests(legacy, 1).filter((name) => startedMatters(name) && !completed.includes(name))
}

function completedDiaries(legacy: LegacySaveV1): string[] {
  const synced: string[] = []
  for (const [region, tiers] of Object.entries(legacy.ws?.achievement_diaries ?? {})) {
    for (const [tier, progress] of Object.entries(tiers)) {
      if (!progress.complete) continue
      // WikiSync spells out the 'and' in 'Kourend & Kebos' and 'Lumbridge & Draynor'
      synced.push(`${region} ${tier}`, `${region.replace(' and ', ' & ')} ${tier}`)
    }
  }
  return [...new Set([...tickedNames(legacy.manual?.diaries), ...synced])]
}

function migrateHiscores(legacy: LegacyHiscores): SavedHiscores {
  return {
    fetchedAt: legacy.fetched,
    skills: forEverySkill((skill) => {
      const stat = legacy.skills[skill]
      return { level: stat?.level ?? 1, xp: stat?.xp ?? 0 }
    }),
    totalLevel: legacy.total?.level ?? 0,
    totalXp: legacy.total?.xp ?? 0,
  }
}

function migrateBlock(block: LegacyBlock, mood: Mood): SessionBlock | null {
  const timer = {
    elapsed: block.elapsed ?? 0,
    runningSince: block.running ?? null,
    done: block.done ?? false,
  }
  const common = { title: block.title, note: block.note ?? '', minutes: block.minutes, ...timer }

  if (block.kind === 'wild') return { kind: 'wildcard', ...common }
  if (block.kind === 'reset') {
    if (!block.k) return null
    const skill = block.skill && isSkillKey(block.skill) ? block.skill : null
    return { kind: 'reset', resetKey: block.k, skill, ...common }
  }
  if (!block.k || !isSkillKey(block.k)) return null
  const intensity = isIntensity(block.int) ? block.int : 'semi'
  // a block dealt before moods were strict does not say what its slot wanted: a strict mood
  // answers for it, and otherwise a swap should offer more of what the block already is
  const wanted = block.want?.filter(isIntensity) ?? (mood === 'balanced' ? [intensity] : [mood])
  return {
    kind: 'skill',
    skill: block.k,
    intensity,
    wanted,
    xpPerHour: block.xph ?? 0,
    rateIsEstimate: block.est ?? false,
    targetXp: block.target ?? 0,
    ...common,
  }
}

function migrateTally(
  gains: Record<string, number> | null | undefined,
  total: number | undefined,
  levels: Record<string, number> | undefined,
): SessionTally {
  const knownGains = bySkill(gains)
  return {
    gains: knownGains,
    totalXp: total ?? Object.values(knownGains).reduce((sum, xp) => sum + xp, 0),
    levels: bySkill(levels),
  }
}

function migrateSession(legacy: LegacySession, mood: Mood): Session {
  const ended = legacy.ended ?? null
  return {
    startedAt: legacy.t0,
    minutes: legacy.minutes,
    blocks: legacy.blocks.flatMap((block) => migrateBlock(block, mood) ?? []),
    startingXp: forEverySkill((skill) => legacy.startSnap?.[skill] ?? 0),
    endedAt: ended,
    tally: ended === null ? null : migrateTally(legacy.gains, legacy.total, legacy.levels),
  }
}

function migrateHistoryBlock(block: {
  kind: string
  k?: string
  title: string
  done?: boolean
}): HistoryBlock | null {
  const common = { title: block.title, done: block.done ?? false }
  if (block.kind === 'wild') return { kind: 'wildcard', ...common }
  if (block.kind === 'reset' && block.k) return { kind: 'reset', resetKey: block.k, ...common }
  if (block.kind === 'skill' && block.k && isSkillKey(block.k)) {
    return { kind: 'skill', skill: block.k, ...common }
  }
  return null
}

function migrateHistoryEntry(entry: LegacyHistoryEntry): HistoryEntry {
  return {
    ...migrateTally(entry.gains, entry.total, entry.levels),
    endedAt: entry.t,
    minutes: entry.minutes,
    elapsed: entry.elapsed ?? 0,
    blocks: (entry.blocks ?? []).flatMap((block) => migrateHistoryBlock(block) ?? []),
  }
}

/**
 * Brings a save from the vanilla app up to the current format. Nothing the player did is lost:
 * quests and diaries WikiSync had read become ordinary ticks, since this app cannot read them
 * again, and so do the quests it had read as started, where the start matters to something. A
 * skill this app does not know (one Jagex added after the data was built) is dropped.
 */
export function migrateLegacySave(legacy: LegacySaveV1): SavedState {
  const blank = blankSave()
  const preferences = legacy.prefs ?? {}
  const mood = isMood(preferences.mood) ? preferences.mood : blank.preferences.mood
  const completed = completedQuests(legacy)
  return {
    version: SAVE_VERSION,
    name: legacy.name ?? '',
    accountType:
      preferences.account === 'main' || preferences.account === 'iron' ? preferences.account : null,
    hiscores: legacy.hs ? migrateHiscores(legacy.hs) : null,
    completedQuests: completed,
    startedQuests: startedQuests(legacy, completed),
    completedDiaries: completedDiaries(legacy),
    // the vanilla app never asked, so nothing was ever declined
    declinedQuests: [],
    declinedDiaries: [],
    allQuests: legacy.manual?.allQuests ?? false,
    allDiaries: legacy.manual?.allDiaries ?? false,
    preferences: {
      mood,
      minutes: preferences.minutes ?? blank.preferences.minutes,
      budget: preferences.budget === 'cheap' ? 'cheap' : 'any',
      tickPerfect: preferences.ticks ?? false,
      excludedSkills: tickedNames(preferences.exclude).filter(isSkillKey),
      includeResets: preferences.dailies ?? true,
      includeWildcard: preferences.wildcard ?? true,
      // the vanilla app dealt no quest steps; a switch that is on by default starts on
      includeQuestStep: blank.preferences.includeQuestStep,
      skillSort: isSkillSort(preferences.sort) ? preferences.sort : blank.preferences.skillSort,
    },
    session: legacy.session ? migrateSession(legacy.session, mood) : null,
    resetLog: { ...legacy.resets },
    history: (legacy.history ?? []).map(migrateHistoryEntry),
    recentSkills: (legacy.rotation ?? []).filter(isSkillKey),
  }
}

/** Brings XP snapshots from the vanilla app up to the current shape, in the same order. */
export function migrateLegacySnapshots(legacy: readonly LegacySnapshot[]): XpSnapshot[] {
  return legacy.map((snapshot) => ({
    takenAt: snapshot.t,
    skills: bySkill(snapshot.skills),
    totalXp: snapshot.total ?? 0,
  }))
}

/**
 * Reads whatever was saved, whichever version wrote it. Null when it is not a save this app
 * understands, in which case the caller starts from `blankSave()`.
 */
export function readSave(value: unknown): SavedState | null {
  if (isLegacySave(value)) return migrateLegacySave(value)
  const isCurrent =
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === SAVE_VERSION
  if (!isCurrent) return null
  // the version tag is the format's promise; a file carrying it is taken at its word
  const save = value as SavedSinceVersionTwo
  // Fields added since version 2 was first written take their blank value where a save lacks
  // them. That is all an older save needs, so adding them did not take a new version number.
  const blank = blankSave()
  return {
    ...save,
    startedQuests: save.startedQuests ?? [],
    declinedQuests: save.declinedQuests ?? [],
    declinedDiaries: save.declinedDiaries ?? [],
    preferences: {
      ...save.preferences,
      includeQuestStep: save.preferences.includeQuestStep ?? blank.preferences.includeQuestStep,
    },
  }
}
