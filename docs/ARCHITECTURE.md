# Architecture

Long Game is a Nuxt 4 application written in TypeScript. This document is the contract every part of the code is built against. If the code and this document disagree, fix one of them in the same change.

## Goals

1. **One codebase, two ways to run.** The public website (pages written out by the build plus a few API routes, on Cloudflare Workers) and a local copy (the same app on a Node server that keeps saves on disk).
2. **The rules of the game live in pure functions.** Everything that decides what an account can do, how long a skill will take and what a session contains is plain TypeScript with no Vue, no DOM and no clock or randomness that is not passed in. It is unit tested.
3. **Components draw, stores hold state, the domain decides.** A component never works out a rate or a requirement itself.
4. **Readable by a stranger.** Full words for names, small files, one job per file, comments that say why.

## Layout

```
app/
  assets/styles/     tokens.scss (custom properties), base.scss (reset, type), fonts.scss, view-transitions.scss,
                     and the shared BEM blocks in blocks/
  components/        one component per file, PascalCase, each owning one BEM block
  composables/       useStatsRefresh, useSavedState, useSaveReady, useAppMode, useQuestProgressProvider, useToast,
                     useConfirm, useMotion, useReveal, useNow, usePageSeo, useRouteSkill, useShareRack, useSuggestMethod,
                     useQuestionRun, useQuestToggle
  layouts/           default.vue (planner), guide.vue (training guides and the error page)
  pages/             index (Tonight), skills/[[skill]], methods/[[skill]], quests, resets, history, settings,
                     guides/ (index, afk, [skill])
  plugins/           persistence.client.ts: loads the save and writes changes back
  stores/            Pinia: account, session, history
  utils/             what a screen says, built as plain text and numbers (see "Text builders"), and the save's storage
  error.vue          the "not found" page and the "did not load" page
shared/
  types/             domain types, imported everywhere
  domain/            pure functions (see below)
  data/              the wiki-sourced data, typed, built from datasrc/ at import time
server/
  api/               hiscores, account type, suggestions, mode, and (local mode only) saved state and snapshots
  routes/            the files for search engines and AI assistants: sitemap.xml, robots.txt, llms.txt, llms-full.txt,
                     data/methods.json
  utils/             the Jagex lookup, the GitHub client, validation, caches, rate limiting, the local saves
modules/             cloudflare-headers.ts: writes the website's `_headers` file at build time
tools/local-copy/    the launcher's steps: install, build and start a local copy
tools/social/        og.html, which public/og.png is rendered from by hand
tests/               Vitest: domain rules, data integrity, app text builders and stores, server rules, the launcher
datasrc/             training methods, quest XP, quest facts and resets as JSON, each entry with its wiki source
public/assets/       skill icons, skillcape images, fonts
public/og.png        the link preview image
wrangler.jsonc       the Cloudflare Worker's settings
Long Game.bat        starts a local copy on Windows
local/               not in the repository: an optional private add-on for one local copy (see "Quest progress")
```

## The domain layer (`shared/domain`)

Pure functions over plain data. No function reads a store, `Date.now()` or `Math.random()` directly: the caller passes the account, the time and the random source.

```ts
// shared/types
type SkillKey = 'attack' | 'defence' | ... | 'sailing'
type Intensity = 'afk' | 'semi' | 'active'
type AccountType = 'main' | 'iron'

interface SkillStat { level: number; xp: number }
interface Account {                       // everything the rules need to know about a player
  type: AccountType
  skills: Record<SkillKey, SkillStat>
  completedQuests: ReadonlySet<string>    // every quest the ticks prove finished (quest-proof.ts)
  startedQuests: ReadonlySet<string>      // started and not finished
  completedDiaries: ReadonlySet<string>   // 'Ardougne Medium'
  allQuests: boolean                      // the quest cape shortcut: every quest counts as done
  allDiaries: boolean
  preferences: { budget: 'any' | 'cheap'; tickPerfect: boolean; excludedSkills: ReadonlySet<SkillKey> }
}
interface Method {                        // one way to train a skill
  skill: SkillKey; level: number; name: string; xpPerHour: number; intensity: Intensity
  cost: 'profit' | 'free' | 'cheap' | 'pricey'; requirements: Requirements; note: string; source: string
  audience: 'both' | 'main' | 'iron'
  timedRun?: { xpPerRun: number; everyMinutes: number }
  usesOwnSupplies: boolean; tickPerfect: boolean; questSkip: boolean; perTripSetup: boolean
  inWilderness: boolean                   // tagged in the tables, said on the skill page and a dealt block
  rateBands?: Array<{ fromLevel: number; xpPerHour: number }>
  computedRate?: 'crab-melee' | 'crab-ranged' | 'rock-magic' | 'frost-magic' | 'gem-magic'
}
```

Modules, each with its own test file in `tests/domain`:

| Module              | Responsibility                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xp.ts`             | the XP table, level for XP, XP to next level                                                                                                              |
| `account.ts`        | a blank account, whether it is an ironman, whether a quest or tier counts as done (Learning the Ropes always does) or started, combat level, quest points |
| `requirements.ts`   | parse a requirement string, list what an account is missing                                                                                               |
| `rates.ts`          | a method's XP per hour at a level, including the rates worked out from the account's own levels                                                           |
| `methods.ts`        | which methods an account can use, the best one, the next unlock                                                                                           |
| `estimates.ts`      | hours and days left per skill, totals to max, whether an estimate is rough, the hours some XP or a level takes                                            |
| `resets.ts`         | timed runs and dailies: how often, whether due                                                                                                            |
| `quests.ts`         | a quest's XP and rewards in words, the levels an account lacks, which quests and diaries gate a method or a reset, every quest known and its facts        |
| `quest-chains.ts`   | which quests a quest requires and which require it, all the way along, from the quest facts; the quests a "not yet" rules out                             |
| `quest-proof.ts`    | what ticks prove: a quest's chain and the quests it needs only started, a tier's lower tiers and its tasks' quests; whose start matters                   |
| `quest-ticks.ts`    | ticking, starting, unticking and declining a quest or a tier with what it proves, so that ticks and "not yet" answers never contradict                    |
| `plan-questions.ts` | which quests and diary tiers are worth asking an account about, in what order, and what each would change                                                 |
| `boosts.ts`         | the biggest boost an account may count toward a quest's or a tier's level (decision 1), and the nearest one it could get; never a method's level          |
| `kudos.ts`          | Kudos within reach: the finished quests', 28 for the natural history quiz, 50 for cleaning finds once The Dig Site is done                                |
| `readiness.ts`      | what a quest or a diary tier still needs of an account, as typed gaps, and the boosts it counts on                                                        |
| `reward-hours.ts`   | the hours a quest's or a tier's XP takes off the time to max, XP with a choice of skill placed as decision 3 says                                         |
| `quest-cost.ts`     | the quests still to do for a quest or a goal in an order that works, whether each is ready when reached, their minutes                                    |
| `combat-plan.ts`    | the cheapest way to a combat level, one level at a time in the combat skill that buys the most an hour (decision 11)                                      |
| `goals.ts`          | where an account stands with each goal: what is done and left, the levels short, the time left; nearly there or on the way                                |
| `suggestions.ts`    | what to do next: quests that save hours for their time, unlocks in the guide's order, diary tiers to claim (decision 6)                                   |
| `quest-step.ts`     | the quest or diary step a session ends on, in the wildcard's place: the first thing Next suggests that fits in half the session (approval 5)              |
| `pace.ts`           | XP per day from snapshots, daily gains, day streak                                                                                                        |
| `planner.ts`        | dealing a session: mood rules, method choice, weights, block lengths, the wildcard or the quest step at the end, swapping a block                         |
| `session.ts`        | a session in play: block timers, finishing a block, the tally of what was gained, the history of finished sessions                                        |
| `snapshots.ts`      | the XP history: the rule for adding a snapshot, and reading a history that came from storage                                                              |
| `save.ts`           | the saved format, its versions, and bringing an old save up to date                                                                                       |
| `capes.ts`          | each skill's cape and trim colour, the readable colour for a thin line, how full a cape is, the order of the rack                                         |
| `format.ts`         | numbers, durations and clocks as text                                                                                                                     |
| `guides.ts`         | the training guides as text: a guide for each skill, the AFK guide, the index                                                                             |
| `site.ts`           | what the site says about itself, the public pages, and the sitemap, robots.txt, llms files and method data built from them                                |
| `site-headers.ts`   | the response headers the website sends, and the `_headers` file Cloudflare reads them from                                                                |

Names are full words: `hoursLeft`, `isIronman`, `skillStat`, never `hrs`, `iron`, `st`. A skill key variable is `skill`, not `k`.

## The data (`shared/data`, `datasrc/`)

`datasrc/` is the source: `methods/<skill>.json`, `quests_set.json`, `quests_lamps.json`, `quest_facts.json`, `diary_facts.json`, `boosts.json`, `quest_goals.json` and `resets.json`, written by hand and from the wiki, each entry with the wiki page it came from. Nothing in it is trusted. `sources.ts` describes the shapes of those files, and the builders (`build-methods.ts`, `build-quests.ts`, `build-quest-facts.ts`, `build-diary-facts.ts`, `build-boosts.ts`, `build-goals.ts`, `build-resets.ts`) check every field and turn them into the typed `Method`, `Quest`, `QuestFacts`, `DiaryFacts`, `Boost`, `Goal` and `Reset` the rest of the app uses; `read-needs.ts` holds the checks the two facts builders share. A builder throws a `DataSourceError` that lists everything wrong with a file. `methods.ts`, `quests.ts`, `quest-facts.ts`, `diary-facts.ts`, `boosts.ts`, `goals.ts` and `resets.ts` run the builders when they are imported, so bad data stops the build and the tests rather than reaching a player. `skills.ts`, `diaries.ts`, `wildcards.ts` and `fallback-rates.ts` are small tables written directly in TypeScript. The last holds the rate an estimate uses at a level where no usable method has one: a flat figure, and bands by level for Slayer, where no source rates a master by the hour.

`quest_facts.json` is the game's whole quest list (184 quests, Recipe for Disaster's 10 parts, 20 miniquests) and the two activities the player ticks like quests (Knight Waves, the natural history quiz), keyed by the app's names. Each entry gives its kind, the wiki page and revision it was read from, the skill levels its page lists, the quests it needs finished (and Druidic Ritual where a Herblore level proves it), the quests it needs only started, the Varrock Museum's lamps where the lamp table has none, whether a miniquest is optional (no quest and no diary task needs it), whether every account has done it (Learning the Ropes, which every player finishes to reach the mainland), and whether its start matters: something (a quest, a diary tier as its page reads, an either-or choice of a tier, a goal) needs it only started. Thirty quests' start matters, Fairytale II's for the fairy rings among them. It is exported from the quest and diary research (`release/research/quests`, not in the repository) by that folder's `tools/export_datasrc.py`, never written by hand: a fact is changed in the research, with its evidence, and exported again. A quest's levels are its facts' levels alone; Temple of Ikov's 40 Ranged is left out on purpose, since the page says it can be bypassed. The quest chains are the facts' `requires`; a quest that only has to be started is not part of a chain. For readiness each entry also says which of its levels may be met with a boost, which are needed only to finish it, and which its page says can be got round (three); the quest points, combat level and Kudos it needs; what an ironman has to make for it and the levels that takes, with a condition where the need applies only sometimes (five, such as steel nails on free-to-play worlds); and what it gives: quest points (343 in all, Recipe for Disaster's part by part, as the game gives them), Kudos (80 from quests, 28 from the natural history quiz) and the 50 that cleaning finds gives once The Dig Site is done. For suggestions each also gives its minutes at an ordinary pace (low, mid and high; the planner uses mid, 2 times speedrun pace, decision 9), an ironman's gathering minutes and the waits, the XP a player places (lamps and rewards with a choice of skills), the XP it pays during the quest, and where each Optimal quest guide finishes it or starts it first. Recipe for Disaster as a whole is not timed: its ten parts are.

`diary_facts.json` (exported the same way) has the 48 achievement diary tiers, keyed `'Ardougne Medium'`, each with its page and revision and the quests its tasks need, finished or only started, as the tier's page reads them. A claimed tier proves at least that much, so where the page says partial completion is enough and Quest Helper and RuneLite ask for the quest finished (six quests), the page's reading is the one kept, and `planFinished` names those quests so readiness asks for them finished (decision 4). For readiness a tier also gives its levels (the safe reading) and which may be boosted; a lower Runecraft level that is enough with Raiments of the Eye pieces (four tiers, shown and never counted, decision 5); its either-or choices; the quest points, combat level and Kudos it needs, and whether it needs every quest; an ironman's own levels; the counts to build up (1,000 chompy kills, offered as long tasks); what else it needs that the app cannot check, in words; and the methods and resets its reward opens, which a test checks against the methods' and resets' own requirements. For suggestions a tier also gives the minutes of its tasks, its reward's items and lamp, and whether a skill guide recommends it.

`quest_goals.json` (exported the same way) holds the 30 milestones: Barrows gloves, the fairy rings, Piety and the rest, each with what it gives in the app's words, its whole quest tree (each quest finished or only started; Knight Waves for Piety), the tiers and levels it needs beyond that, and the step of each guide that reaches it. The early ironman path is the ironman guide's own milestone and is offered to ironmen only.

`boosts.json` (exported the same way) holds the boosts decision 1 counts toward a boostable quest or tier level: 35 in 20 skills, each with the wiki page and revision it was read from, the words a sentence names it by ('a super fishing potion'), its size (a flat number of levels, or a base and a share of the level) and who may count it, a main and an ironman apart: always, never, or with a level (an ironman makes its own pies and potions, so it counts one only at the level that makes it).

`quests_set.json` holds the fixed XP of the wiki's XP table, and `quests_lamps.json` the skill-choice lamps of `Module:SkillChoice`; every quest in either must be an entry of the facts, which give it its kind and its levels.

`tests/data` checks the builders (`build.test.ts`) and the built data itself (`integrity.test.ts`).

## State (`app/stores`)

| Store     | Holds                                                                                                                           | Persists |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `account` | name, stats, quests done and started, diaries done, the ones answered "not yet", preferences, when each reset was done          | yes      |
| `session` | tonight's blocks, their timers, the last tally, the skills dealt lately; for the visit only, a quest step waiting on its answer | yes      |
| `history` | finished sessions and XP snapshots                                                                                              | yes      |

Stores expose derived values as getters that call the domain (for example `account.skillInsights`). `useSavedState` joins the three into one save and puts a save back into them.

### Saving

One plugin, `plugins/persistence.client.ts`, loads the save once the page has hydrated, sets `useSaveReady()` to true, and from then on writes any change back a moment later. Where the save lives is behind one interface, `SaveStorage` in `app/utils/save-storage.ts`: the browser's own storage on the website, the server's `/api/state` and `/api/snapshots` in a local copy. XP snapshots are not part of the save. They are kept by player name, so the same name picks its history up again.

### The saved format

The format is versioned, and an old save is never thrown away, only brought up to date (`readSave` in `shared/domain/save.ts`).

| Version | Marked by    | Written by                | Shape                                                              |
| ------- | ------------ | ------------------------- | ------------------------------------------------------------------ |
| 1       | `v: 1`       | the app this one replaced | `LegacySaveV1`: its own field names (`hs`, `prefs`, `manual`, ...) |
| 2       | `version: 2` | this app                  | `SavedState`: plain JSON, lists rather than sets, full-word names  |

A version 1 XP snapshot is `{ t, skills, total }`; this app's is `{ takenAt, skills, totalXp }`.

A field added to version 2 after it was first written does not take a new version number as long as a save without it means the same as one with its blank value: `readSave` fills it in. `declinedQuests` and `declinedDiaries` (the "not yet" answers) and `startedQuests` (the quests started and not finished) were added that way, and so was the preference `includeQuestStep` (a quest step on Tonight, on unless the player switches it off). A session's blocks gained a kind, `quest`, which an older save never contains, so nothing had to be brought up to date. A version 1 save's quests WikiSync had read as started (state 1) become started quests, where the start matters.

The file that Settings exports is versioned separately (`app/utils/export-file.ts`): `{ longgame: 2, save, snapshots }`. The previous app's `{ longgame: 1, state, snaps }` is still read.

## Text builders (`app/utils`)

What a screen says is worked out in plain functions, not in templates: a component passes in store values and gets back the strings and numbers it draws. That keeps the wording testable without mounting anything. Each has a test in `tests/app`.

| File                                                                   | What it builds                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tonight-deal.ts`, `tonight-session.ts`, `tonight-side.ts`             | Tonight: the deal panel, the live block and its slots, the tally, the side panels                                                                                                         |
| `tonight-quest.ts`                                                     | Tonight's quest step: what it is, why it was dealt, and what its Done asks                                                                                                                |
| `skill-rows.ts`, `skill-detail.ts`, `skill-strip.ts`, `method-rows.ts` | Skills and Methods: a row per skill, a skill's detail, its strip from 1 to 99, a method's cells                                                                                           |
| `reset-rows.ts`, `history-display.ts`                                  | Resets and History                                                                                                                                                                        |
| `quest-questions.ts`                                                   | Quests: the question card, the list of answers, the tick list's rows, the page's four parts and their addresses; the prompt on Tonight                                                    |
| `quest-readiness.ts`                                                   | what a quest or tier not done says: ready, ready with a boost, or what it needs, short or in full; each diary's next tier                                                                 |
| `quest-next.ts`, `quest-goals.ts`                                      | the Quests page's Next (a row for each suggestion and its button) and Goals (the two capes, each goal's row)                                                                              |
| `quest-words.ts`                                                       | phrases the Quests page and Tonight share: lists and lengths of time in a sentence, a quest's place in a goal, a tier's reward. Light, because Tonight's words load on every planner page |
| `methods-note.ts`                                                      | the note with a list of methods: it is not complete, and how a method gets added                                                                                                          |
| `rack-picture.ts`                                                      | the layout and wording of the picture "Share my rack" draws (`draw-rack-picture.ts` paints it)                                                                                            |
| `hiscores.ts`                                                          | Jagex's hiscores JSON into the shape the app saves, and what a refresh says                                                                                                               |
| `quest-progress.ts`                                                    | checks what a quest-progress add-on reports                                                                                                                                               |
| `seo.ts`, `brand-mark.ts`                                              | a page's head and structured data; the icon's fill                                                                                                                                        |
| `save-storage.ts`, `export-file.ts`, `returning-player.ts`             | where the save lives, the export file, the first-paint script                                                                                                                             |
| `api-error.ts`, `suggestion.ts`, `format.ts`                           | an API error as a sentence, the suggestion form's draft, small formatters                                                                                                                 |

There is no clock composable. A component that shows time keeps it itself: `SessionClock` draws a running stopwatch and `BlockProgress` the line under the live panel, each reading `useNow()`, so one second passing redraws that text and nothing around it.

## Server (`server/`)

| Route                              | Website                                                  | Local copy                        |
| ---------------------------------- | -------------------------------------------------------- | --------------------------------- |
| `GET /api/hiscores?name=`          | looks the player up on Jagex's hiscores, kept one minute | same                              |
| `GET /api/account-type?name=`      | main or ironman                                          | same                              |
| `POST /api/suggestions`            | files a method suggestion as a GitHub issue              | 404                               |
| `GET /api/mode`                    | `{ mode: 'hosted' }`                                     | `{ mode: 'local' }`               |
| `GET /api/state`, `PUT /api/state` | 404                                                      | the saved state, on disk          |
| `GET /api/snapshots?name=`         | 404                                                      | a player's XP history             |
| `POST /api/snapshots`              | 404                                                      | adds a reading to that history    |
| `GET /api/quest-progress?name=`    | 404                                                      | 404, unless an add-on supplies it |
| any other `/api/...`               | 404 as JSON (`server/api/[...].ts`)                      | same                              |

A route that belongs to the other mode answers 404 exactly as if it were not there (`requireMode`). The catch-all exists so that a wrong API address, or a real one asked with the wrong method, gets a JSON error and not a web page.

All input is validated at the edge. No route trusts the browser. Route handlers are thin: a rule that can refuse a request is a plain function in `server/utils` that returns a `Result` (`result.ts`) and has a test in `tests/server`; the handler turns a refusal into the one error shape described in `errors.ts`. Writes are refused when another site makes them through the player's browser (`requireSameOrigin`).

**Reusing answers.** One hiscores lookup a minute per name is plenty. The route keeps answers in a `LookupCache` (`lookup-cache.ts`): on the website that is Cloudflare's cache (`caches.default`), which every isolate in a data centre shares; anywhere else it is the process's own memory. Cloudflare's cache does nothing on a `workers.dev` address, only on the site's own domain. The suggestion limiter (`rate-limiter.ts`) is held in memory per isolate and is a courtesy limit; a firm one is a rate limiting rule in the Cloudflare dashboard.

**Local saves.** `local-saves.ts` keeps the state in `.data/kv/state.json` and each history in `.data/kv/snapshots/<name>.json`, through Nitro's `data` storage mount. No file system code is written here or bundled into the Worker.

**Carrying an old save over.** The previous app kept `data/state.json` and `data/snapshots_<name>.json` at the top of the project. A local build mounts that folder read-only as `legacy-saves`. While `.data` has no state, `GET /api/state` serves the old file as it is and the app brings it up to date (`readSave`). While `.data` has no history for a player, the old one is served in this app's shape and the next reading is added to it. The first write lands in `.data`, which is read from then on. The old files are never written to.

### Quests and diaries

The hiscores say nothing about quests or diaries, and there is no public source for them, so the app asks. Only a few dozen quests and diary tiers are a requirement of anything the planner deals, and for any one account most of those change nothing, so it does not ask about them all.

- **The rule** is `planQuestions` in `shared/domain/plan-questions.ts`. A quest or diary tier is worth a question when a yes would take at least half an hour off the hours to max, change the method some skill's AFK, semi-AFK or active block would be dealt (`methodForBlock`), or open a reset. Questions are ordered by hours saved, then by how much of the plan they change, then by name. The list is worked out again after every answer (`account.planQuestions`), because one answer changes what the others are worth.
- **Two rounds.** `planQuestions` hands the questions back in two lists: the ones that save hours (`savingHours`), and the smaller ones that only add a reset or another method a block could be dealt (`smaller`). The page asks the first round, pauses to say the hours are now right, and asks the second only if the player chooses to. The prompt on Tonight counts the first round only.
- **A quest that carries another's saving is asked first.** A quest's saving counts what the quests it requires unlock, so a dozen quests can each seem to save what is Druidic Ritual's doing. Within the first round, a quest is never asked before one it requires whose own saving is at least half of its saving (`askCarriersFirst`); once that one is answered, the rest are ranked on what they add themselves.
- **What a tick proves.** A finished quest proves every quest it requires finished and the quests it needs only started, started; a claimed diary tier proves the tiers below it (a reward can only be claimed once they are) and the quests its tasks need, as its page reads them; a started quest proves nothing more (`quest-proof.ts`). Every tick writes in what it proves, and the stores write it into a save as it is loaded, so a save from before a rule gains what the rule proves: the fixture's Ardougne, Kandarin and Lumbridge & Draynor Medium tiers make its Fairytale II started. The account the rules see is read through the same proof (`accountFromSave`), the diary cape shortcut proving what every tier would.
- **Quest chains.** A yes ticks the quest and everything it proves; a "not yet" rules out every quest that requires it, and every tier that needs it finished or sits above a tier answered "not yet", which is worked out from the stored answers each time and never stored itself; unticking a quest unticks the quests that require it and the claimed tiers that need it finished, with the tiers above them (`quest-chains.ts`, `quest-ticks.ts`). Unticking a tier unticks the tiers above it. Whatever an action changes beyond its own quest or tier is said to the player.
- **Readiness.** `questReadiness` and `diaryReadiness` (`readiness.ts`) say what a quest or a tier still needs of an account, as typed gaps in a fixed order: lower tiers, quests (finished, or only started), levels, quest points, combat, Kudos, either-or choices, every quest, an ironman's levels. A boostable level counts as met when the biggest boost the account may count covers it (`boosts.ts`), and the boost is named; when none does, the gap names the nearest one, if getting it takes fewer levels than training the skill. Kudos are the ones within reach (`kudos.ts`, approval 6). A level a page says can be got round never stands in the way, nor does an ironman's need that applies only sometimes, nor anything the app cannot check (in an either-or need it counts as met). Asked about starting a quest, the levels needed only to finish it and an ironman's needs are left out. The tests walk both Optimal quest guides from a fresh account with these rules (`tests/domain/guide-walk.ts`, the guides' orders in `tests/fixtures/quest-orders.json`) and check them against the research's acceptance cases. The tick list shows it: every quest not done has a line under its name (`ReadinessLine`), Ready, Ready with the boost, or what it needs, cut to three needs, and its tick box is described by the whole sentence with the account's own figures ("70 Prayer (you have 52)"), which a screen reader would not otherwise hear past the box's label. The diary grid has no room for words, so under it `DiaryNext` lists each diary's next tier, the lowest one not claimed, with the same line, and for a ready tier what it still has to build up. The words are `quest-readiness.ts`'s.
- **Started quests.** A quest whose start matters has a third state: a press of its tick box moves it from not done to started to done and back to not done (`account.stepQuest`). A quest that something still ticked needs started goes back to started and no further, and the player is told what holds it there. Started is drawn as the box half filled from the bottom, with a "Started" tag beside the name, and the tick list's filter has a "Started" choice.
- **Carriers.** A diary tier's yes settles the quests its tasks need, so its question carries their hours: a quest or a lower tier that carries at least half of a tier's saving is asked first, as a quest's prerequisite is (`askCarriersFirst`).
- **Next** (`suggestions.ts`) has three lists. Quests that save hours: every quest the account is ready for with whatever has to come first (`quest-cost.ts`), whose unlocks (the questions' own `requirementEffect`) and XP (`reward-hours.ts`) take at least half an hour off, the most hours for their time first; a quest whose saving is mostly a quest it requires is left out until that one is done. Unlocks that save no hours (decision 7): the account's goals in the order its own Optimal quest guide reaches them, each with its next quest, ready or with what it needs. Diary tiers ready to claim, in decision 6's order. Every row's button marks its quest or tier (`account.markQuest`, `account.markDiary`), forward only.
- **Goals** (`goals.ts`): the two capes no skill gives, and each goal's progress, what is left and the time left: the quests' minutes, the tiers' minutes, the quickest other quests to make up quest points, and the training to the levels short at the account's own rates, combat levels the cheapest way (`combat-plan.ts`). Under two hours left is nearly there.
- **Tonight's quest step** (approval 5). With "One quest or diary step per session" on in Settings (the default), a session of an hour or more that is not AFK ends on one step from Next, in the wildcard's place, which is then the fallback (`quest-step.ts`). The steps are tried in this order: what saves hours, the most for its whole time first (a quest by the first of the steps it takes, and the diary tiers whose reward opens something); then the next quest towards each goal in the account's guide that it is ready for; then the other tiers. The first that fits in half the session is dealt, its length rounded to five minutes, and the planner gives the skills a slot for every 40 minutes it leaves. Tonight works the step out and hands it to the deal (`session.deal`), so the suggestion rules load with Tonight and the Quests page rather than with every page; the deal line says "one quest step". The step's Done stops its clock and asks whether the player finished it (`session.askStep`, `answerStep`); either way the block is done, and a yes ticks the quest or tier, or marks the quest started, through the account store.
- **The Quests page** has four parts, each with an address: `/quests?tab=questions` (the question card and the answers so far), `/quests?tab=next`, `/quests?tab=goals` and `/quests?tab=tick-list` (every quest, miniquest, activity and diary tier, to tick by hand, which is also how an answer is undone; Learning the Ropes is done for every account and its tick cannot be taken away). `/quests` alone opens the questions while there are any and Next otherwise, and the address is then rewritten to name the part. `/quests?tab=xp`, the part Next replaced, opens Next.
- **What is kept.** Ticks and "not yet" answers are saved with the account. The list of answers beside the card, whether the prompt on Tonight has been put off, and whether the player has gone on to the smaller questions are kept for the visit only (`useQuestionRun`).

### Quest progress from a local add-on

The published app does not read quests or diaries from anywhere: it asks the player, as above. It does have a small extension point for a local copy, and nothing more.

- **The contract.** `GET /api/quest-progress?name=` answers `{ quests: string[], started?: string[], diaries: string[], fetched: number }` (`shared/types/quest-progress.ts`): quest names as the app's own data names them (requirement strings and `shared/data/quests.ts`), the quests started and not finished if the provider can tell (only those whose start matters are kept), diary tiers as a region and a tier (`'Kourend & Kebos Hard'`), and the time it was read.
- **The switch.** `runtimeConfig.public.questProgressProvider`. It is false in the published code. `useQuestProgressProvider()` is true only when it is true and the app is in local mode.
- **What the app does.** With a provider, `useStatsRefresh` asks the route after each successful hiscores refresh and the account store ticks whatever is reported, with what it proves (`recordProgress`). Ticks are only added, never taken away, and a failed request changes nothing. The Quests page says that progress is filled in by a local add-on, has no questions part, and Tonight shows no prompt. With no provider, no request is made.
- **Where a provider comes from.** A Nuxt layer in `local/`, which is git-ignored. `nuxt.config.ts` extends it only when `local/nuxt.config.ts` exists and the build is a local copy, so the website is always built from the published code alone. The layer supplies the route and sets the switch. The launcher rebuilds when the folder is added or removed.

## The public pages and the first visit

The website is written out as files when it is built (the prerender step of `nuxt build`). `prerenderedRoutes()` in `shared/domain/site.ts` names every address: the seven planner screens, the guide index, the AFK guide, a guide for each skill, `404.html` (drawn by `app/error.vue`) and the five files under `server/routes`. The sitemap lists the public pages only: the home page and the guides. The other planner screens carry `noindex`, because without an account they are the setup screen and nothing else. A page with a parameter (`/skills/mining`, `/methods/mining`) is not written out; the server draws it when asked.

A page written out by a build carries that build's settings, so `NUXT_PUBLIC_SITE_URL` has to be right when the website is built, and a local copy has to be built with `NUXT_PUBLIC_MODE=local` (which writes no pages out: its own server renders them).

Guide addresses end in a slash (`/guides/mining/`); planner addresses do not (`/skills`). The files are named to match (`guides/mining/index.html`, `skills.html`), because Cloudflare serves a file at the address its name spells and redirects the other spelling to it. Links, canonical addresses and the sitemap use `guidePath()`.

What a planner page draws is decided in one place, `PlannerPage`:

|            | Before the save has loaded                    | No account             | An account  |
| ---------- | --------------------------------------------- | ---------------------- | ----------- |
| Website    | the first-visit screen, as the server sent it | the first-visit screen | the planner |
| Local copy | nothing                                       | the setup screen       | the planner |

The first-visit screen is the setup screen and, on the home page, the landing content (`LandingSections`), which also sets the home page's title, description and structured data. It is in the HTML the server sends, so a new visitor and a search engine get a real page. A returning player is sent the same HTML, since their save is in their browser. A script in the head (`app/utils/returning-player.ts`, added in `nuxt.config.ts`) looks for a saved account before the first paint and puts the class `returning-player` on `<html>`; `PlannerPage` hides the first-visit screen under that class and takes the class off once the save has loaded. Whatever a page puts in `PlannerPage`'s default slot is only rendered in the browser, with the save loaded and an account in the stores.

## Building and running

| What                 | Command                | Preset              | Mode     | Built into                     |
| -------------------- | ---------------------- | ------------------- | -------- | ------------------------------ |
| Development          | `npm run dev`          | Nitro's dev server  | `hosted` | `.nuxt`                        |
| The website          | `npm run build:site`   | `cloudflare-module` | `hosted` | `.output`                      |
| The website, locally | `npm run preview:site` | (runs `.output`)    | `hosted` |                                |
| Publish              | `npm run deploy`       | (builds first)      | `hosted` |                                |
| A local copy         | `npm run build:local`  | `node-server`       | `local`  | `.nuxt-local`, `.output-local` |
| Start a local copy   | `npm run start:local`  | (runs the build)    | `local`  | saves in `.data`               |

The preset is named by the script, not in `nuxt.config.ts`: a Cloudflare preset named there would switch `nuxt dev` to Cloudflare's emulation as well.

**The website** is one Cloudflare Worker with static assets. Cloudflare serves the files in `.output/public` itself and runs the Worker for everything else: the API, the pages that are not written out, and the "not found" page. `wrangler.jsonc` holds the Worker's name and its non-secret variables; the build adds where it put things and writes the full configuration to `.output/server/wrangler.json`, which wrangler finds through `.wrangler/deploy/config.json`. The Worker needs nothing from Node, so `nodejs_compat` is off. The one secret is `NUXT_GITHUB_TOKEN`.

**Headers.** The server puts the security headers on what it answers itself through `routeRules`. Files served from disk never reach it, so their headers, including the year-long cache lifetime of `/assets` and the hashed files under `/_nuxt`, are in `.output/public/_headers`, written by `modules/cloudflare-headers.ts`. Both read `shared/domain/site-headers.ts`.

**A local copy** is the same app built with `NUXT_PUBLIC_MODE=local` and the Node preset. `nuxt.config.ts` reads that variable: local mode is built in, no pages are written out, the build goes to its own folders, and the old saves folder and the add-on, if there is one, are taken in. `tools/local-copy/` holds the steps (`steps.ts`) and the decisions behind them as tested functions (`freshness.ts`). `Long Game.bat` checks for Node 22.18 or newer and runs `launch.ts`, which installs when `package-lock.json` is newer than the last install, builds when a source file is newer than the build, starts the server on `http://localhost:8765/` (`LONGGAME_PORT` changes the port) and opens the browser. The server listens on this machine only. It is always started from the top of the project, which is what puts the saves in `<project>/.data` wherever the launcher was started from.

## CSS: BEM

- **Block** = the component, in kebab case: `cape-rack`. **Element** = `cape-rack__cape`. **Modifier** = `cape-rack__cape--current`.
- One block per component, written in that component's `<style lang="scss">` (not scoped: BEM is the scoping). Use Sass nesting only to build names (`&__cape`, `&--current`), never to raise specificity.
- An element belongs to its block, not to another element: `cape-rack__level`, never `cape-rack__cape__level`.
- State is a modifier (`--current`, `--done`, `--locked`), set from the template. No `is-` classes, no styling by tag or id, no `!important`.
- A component never styles another component's block. To vary a child, give it a prop that sets its own modifier.
- A child component's root may carry one of the parent's element classes (`<SessionClock class="live-panel__clock" />`). That class is for layout only: where the child sits, its margin, its grid cell. How the child looks is the child's own block.
- A selector names one class. Where one element's state has to change another element of the same block, a selector may join the two, with a comment saying why. There are three cases in the code: a table row's state or hover colouring its cells (`data-table`, `skills-table`), a cape under the pointer moving its hanger (`cape-rail`), and a tick box's button under the pointer lighting its box (`tick-box`). `guide-crumbs` also uses a sibling selector to draw the stroke between two steps.
- A selector starts with its own block. The one exception is `.returning-player`, a class a head script puts on `<html>` before any component exists: `PlannerPage` has two selectors under it that hide its first-visit screen (see "The public pages and the first visit").
- Shared blocks that are not components live in `app/assets/styles/blocks/`: `button` and `action-row`, `chip` and `chip-group`, `game-number` (the player's numbers in the RuneScape font), `field` and `input`, `data-table`, `note`, `section-heading`, `tag`, `page-width` and `visually-hidden`.
- Three components are the typed way to use a shared block and add no styles of their own: `GameNumber` (`game-number`), `ChipGroup` (`chip-group` and `chip`) and `ToggleChip` (`chip`).
- `skill-icon` is not a shared block. It belongs to the `SkillIcon` component like any other.
- Colours, type and spacing come from custom properties in `tokens.scss`. Component styles do not contain raw colours except a skill's cape colour, which arrives as a custom property set inline.

## Brand rules that the code enforces

Stat yellow (`--color-stat`) is reserved for: the wordmark's 9s, the icon tile, the player's numbers, the active tab line, the one primary action, the live slot outline and the pointer under the live cape, and the focus ring, text selection and caret. Everything else that needs colour takes it from the skillcape (`shared/domain/capes.ts`). See `DESIGN.md`.

## Tests

```
npm run test          every test, once (vitest run)
npx vitest            the same, watching for changes
npx vitest run tests/domain/planner.test.ts     one file
```

| Folder         | What it tests                                         |
| -------------- | ----------------------------------------------------- |
| `tests/domain` | the rules in `shared/domain`                          |
| `tests/data`   | the data builders and the built data                  |
| `tests/app`    | the text builders in `app/utils` and the three stores |
| `tests/server` | the rules in `server/utils`                           |
| `tests/tools`  | the launcher's decisions                              |

The tests run in Node without Nuxt. Code under test imports what it needs by name; where a server util uses one of Nitro's auto-imports (`useStorage`), the test stands in for it.

## Quality bar

`npm run check` must pass before anything is merged: ESLint, `nuxt typecheck` in strict mode, and Vitest. `npm run format:check` checks formatting. No `any`, no non-null `!` without a comment saying why, no dead code, no commented-out code.
