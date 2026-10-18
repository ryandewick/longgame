import { describe, expect, it } from 'vitest'
import type { Quest } from '#shared/types/quest'
import type { PlanQuestion, PlanRequirement } from '#shared/domain/plan-questions'
import type { QuestTicks } from '#shared/domain/quest-ticks'
import { accountWith } from '../domain/helpers'
import {
  QUESTS_TABS,
  alsoChangedNotice,
  alsoChangedSentence,
  answerAnnouncement,
  answerRows,
  answersStanding,
  filterQuestRows,
  hoursInWords,
  hoursTakenOff,
  listInWords,
  progressLabel,
  questRows,
  questionAnnouncement,
  questionSentence,
  questionWording,
  questionsDoneSummary,
  questionsPrompt,
  questsTabFor,
  questsTabPath,
  requirementLabel,
  roundProgress,
  savingFigure,
  setAsideNote,
  smallerQuestionAdds,
  smallerRoundNote,
  stepLabel,
  tickedCountLabel,
  unlockRows,
  type GivenAnswer,
} from '~~/app/utils/quest-questions'

const quest = (name: string): PlanRequirement => ({ kind: 'quest', name })
const diary = (name: string): PlanRequirement => ({ kind: 'diary', name })

const question = (
  requirement: PlanRequirement,
  hoursSaved: number,
  opens: string[] = [],
): PlanQuestion => ({
  requirement,
  hoursSaved,
  skillsChanged: [],
  resetsOpened: [],
  methodsOpened: [],
  opens,
})

const answer = (
  requirement: PlanRequirement,
  done: boolean,
  hoursSaved = 0,
  alsoTicked: string[] = [],
): GivenAnswer => ({ requirement, done, hoursSaved, alsoTicked })

describe('the three parts of the Quests page', () => {
  const asking = { asksQuestions: true, questionsWaiting: 3 }

  it('have an address each', () => {
    expect(QUESTS_TABS.map(({ tab }) => questsTabPath(tab))).toEqual([
      '/quests?tab=questions',
      '/quests?tab=tick-list',
      '/quests?tab=xp',
    ])
  })

  it('open at the part the address names', () => {
    expect(questsTabFor('questions', asking)).toBe('questions')
    expect(questsTabFor('tick-list', asking)).toBe('tick-list')
    expect(questsTabFor('xp', asking)).toBe('xp')
  })

  it('open at the questions while there are any to ask, and at the tick list when there are none', () => {
    expect(questsTabFor(undefined, asking)).toBe('questions')
    expect(questsTabFor(undefined, { asksQuestions: true, questionsWaiting: 0 })).toBe('tick-list')
    expect(questsTabFor('nonsense', asking)).toBe('questions')
    expect(questsTabFor(['xp', 'questions'], asking)).toBe('questions')
  })

  it('stay on the questions once named, so the last answer leaves its ending on show', () => {
    expect(questsTabFor('questions', { asksQuestions: true, questionsWaiting: 0 })).toBe(
      'questions',
    )
  })

  it('have no questions part where an add-on fills quests in, whatever the address says', () => {
    const filledIn = { asksQuestions: false, questionsWaiting: 3 }
    expect(questsTabFor(undefined, filledIn)).toBe('tick-list')
    expect(questsTabFor('questions', filledIn)).toBe('tick-list')
    expect(questsTabFor('xp', filledIn)).toBe('xp')
  })
})

describe('the question', () => {
  it('asks whether a quest is finished', () => {
    expect(questionWording(quest('Sins of the Father'))).toEqual({
      lead: 'Have you finished',
      subject: 'Sins of the Father?',
    })
    expect(questionSentence(quest('Sins of the Father'))).toBe(
      'Have you finished Sins of the Father?',
    )
  })

  it('asks whether a diary tier is completed, by region and tier', () => {
    expect(questionWording(diary('Ardougne Medium'))).toEqual({
      lead: 'Have you completed the',
      subject: 'Ardougne Medium diary?',
    })
    expect(questionSentence(diary('Kourend & Kebos Hard'))).toBe(
      'Have you completed the Kourend & Kebos Hard diary?',
    )
  })

  it('names a requirement in a list: a quest by name, a tier as a diary', () => {
    expect(requirementLabel(quest('Bone Voyage'))).toBe('Bone Voyage')
    expect(requirementLabel(diary('Desert Hard'))).toBe('Desert Hard diary')
  })
})

describe('smallerQuestionAdds', () => {
  const smaller = (changes: Partial<PlanQuestion>): PlanQuestion => ({
    ...question(quest('Any'), 0),
    ...changes,
  })

  it('says which timed run or daily a yes adds', () => {
    expect(smallerQuestionAdds(smaller({ resetsOpened: ['Sand from Bert'] }))).toBe(
      'Adds Sand from Bert to your sessions.',
    )
    expect(smallerQuestionAdds(smaller({ resetsOpened: ['Birdhouse run', 'Giant seaweed'] }))).toBe(
      'Adds Birdhouse run and Giant seaweed to your sessions.',
    )
  })

  it('says which method a yes adds, and for which skills', () => {
    expect(
      smallerQuestionAdds(
        smaller({ methodsOpened: [{ name: 'Karambwan', skills: ['cooking', 'fishing'] }] }),
      ),
    ).toBe('Adds Karambwan as an option for Cooking and Fishing.')
    expect(
      smallerQuestionAdds(
        smaller({ methodsOpened: [{ name: "Giants' Foundry", skills: ['smithing'] }] }),
      ),
    ).toBe("Adds Giants' Foundry as an option for Smithing.")
  })

  it('puts methods that train the same skills in one sentence, and the reset first', () => {
    expect(
      smallerQuestionAdds(
        smaller({
          resetsOpened: ['Kingdom of Miscellania'],
          methodsOpened: [
            { name: 'Iron darts', skills: ['smithing'] },
            { name: 'Chaeldar', skills: ['slayer'] },
            { name: 'Dart tips and nails', skills: ['smithing'] },
          ],
        }),
      ),
    ).toBe(
      'Adds Kingdom of Miscellania to your sessions. Adds Iron darts and Dart tips and nails as options for Smithing. Adds Chaeldar as an option for Slayer.',
    )
  })

  it('sums the methods up in one sentence when they train more than two sets of skills', () => {
    expect(
      smallerQuestionAdds(
        smaller({
          methodsOpened: [
            { name: 'Iron darts (own dart tips)', skills: ['fletching'] },
            { name: 'Dart tips and nails', skills: ['smithing'] },
            { name: 'Burst or barrage Slayer tasks', skills: ['magic'] },
            { name: 'Ectofuntus', skills: ['prayer'] },
            { name: 'Mazchna', skills: ['slayer'] },
          ],
        }),
      ),
    ).toBe(
      'Adds Iron darts (own dart tips), Dart tips and nails, Burst or barrage Slayer tasks and 2 more as options for Fletching, Smithing, Magic and 2 more.',
    )
  })

  it('says a reset once when a method behind it has the same name', () => {
    expect(
      smallerQuestionAdds(
        smaller({
          resetsOpened: ['Tears of Guthix'],
          methodsOpened: [{ name: 'Tears of Guthix', skills: ['cooking'] }],
        }),
      ),
    ).toBe('Adds Tears of Guthix to your sessions.')
  })
})

describe('the two rounds', () => {
  const given = [
    answer(quest('Druidic Ritual'), true, 291),
    answer(quest('Sins of the Father'), false, 61),
    answer(quest('Tears of Guthix'), true, 0),
    answer(diary('Desert Hard'), false, 0.1),
    answer(diary('Kandarin Easy'), true, 0),
  ]

  it('count for themselves: the answers given in a round, and the questions it has waiting', () => {
    expect(roundProgress(given, 9, 'hours')).toEqual({ step: 3, total: 11 })
    expect(roundProgress(given, 13, 'smaller')).toEqual({ step: 4, total: 16 })
    expect(roundProgress([], 10, 'hours')).toEqual({ step: 1, total: 10 })
  })

  it('pause between them with how many smaller questions are left and what they are for', () => {
    expect(smallerRoundNote(16)).toEqual({
      title: 'Your hours to max are now right',
      left: '16 smaller questions are left.',
      purpose:
        'They add daily runs and alternative methods to your plan. They do not change your hours to max.',
      answerLabel: 'Answer them now',
    })
    expect(smallerRoundNote(1)).toEqual({
      title: 'Your hours to max are now right',
      left: '1 smaller question is left.',
      purpose:
        'It adds a daily run or an alternative method to your plan. It does not change your hours to max.',
      answerLabel: 'Answer it now',
    })
  })

  it('do not pause when there is no second round to offer', () => {
    expect(smallerRoundNote(0)).toBeNull()
  })
})

describe('savingFigure', () => {
  it('gives whole hours with their unit', () => {
    expect(savingFigure(60.6)).toEqual({ figure: '61', unit: 'hours' })
    expect(savingFigure(1234.4)).toEqual({ figure: '1,234', unit: 'hours' })
    expect(savingFigure(1.2)).toEqual({ figure: '1', unit: 'hour' })
  })

  it('gives minutes inside the first hour', () => {
    expect(savingFigure(0.75)).toEqual({ figure: '45', unit: 'minutes' })
    expect(savingFigure(0.5)).toEqual({ figure: '30', unit: 'minutes' })
  })

  it('gives nothing for a saving too small to count, so the card says so in words', () => {
    expect(savingFigure(0.49)).toBeNull()
    expect(savingFigure(0)).toBeNull()
  })
})

describe('hoursInWords', () => {
  it('writes the unit out', () => {
    expect(hoursInWords(431.8)).toBe('432 hours')
    expect(hoursInWords(1.4)).toBe('1 hour')
    expect(hoursInWords(0.5)).toBe('30 minutes')
    expect(hoursInWords(2388)).toBe('2,388 hours')
  })
})

describe('listInWords', () => {
  it('joins names the way a sentence does', () => {
    expect(listInWords([])).toBe('')
    expect(listInWords(['Minnows'])).toBe('Minnows')
    expect(listInWords(['Plague City', 'Biohazard'])).toBe('Plague City and Biohazard')
    expect(listInWords(['Vyrewatch Sentinels', 'Blisterwood tree', 'Hallowed Sepulchre'])).toBe(
      'Vyrewatch Sentinels, Blisterwood tree and Hallowed Sepulchre',
    )
  })

  it('counts what it has no room to name', () => {
    expect(listInWords(['A', 'B', 'C', 'D'])).toBe('A, B, C and 1 more')
    expect(listInWords(['A', 'B', 'C', 'D', 'E'], 2)).toBe('A, B and 3 more')
  })

  it('sets names apart with semicolons when one has a comma of its own', () => {
    expect(listInWords(['Herb tar', 'Antifire, ranging, magic potions', 'Super restores'])).toBe(
      'Herb tar; Antifire, ranging, magic potions; and Super restores',
    )
    expect(listInWords(['Attack, strength, energy potions', 'Herb tar', 'A', 'B'], 2)).toBe(
      'Attack, strength, energy potions; Herb tar; and 2 more',
    )
    // a comma in a name that is not shown changes nothing
    expect(listInWords(['A', 'B', 'C, D'], 2)).toBe('A, B and 1 more')
  })
})

describe('what else an action changed', () => {
  it('names the quests ticked or unticked along with it', () => {
    expect(alsoChangedSentence(true, ['Biohazard', 'Plague City'])).toBe(
      'Also ticked: Biohazard and Plague City.',
    )
    expect(alsoChangedSentence(false, ['Regicide'])).toBe('Also unticked: Regicide.')
  })

  it('cuts a long list short with a count', () => {
    expect(alsoChangedSentence(true, ['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe(
      'Also ticked: A, B, C and 4 more.',
    )
  })

  it('says nothing when nothing else changed', () => {
    expect(alsoChangedSentence(true, [])).toBe('')
    expect(alsoChangedNotice(answer(quest('Plague City'), true))).toBe('')
    expect(alsoChangedNotice(answer(quest('Biohazard'), false))).toBe('')
  })

  it('says which answer it was, for the card that has moved on to the next question', () => {
    expect(
      alsoChangedNotice(
        answer(quest('Bone Voyage'), true, 365, ['Druidic Ritual', 'The Dig Site']),
      ),
    ).toBe('Bone Voyage ticked. Also ticked: Druidic Ritual and The Dig Site.')
  })
})

describe('the card’s smaller lines', () => {
  it('count the questions', () => {
    expect(stepLabel(5, 13)).toBe('Question 5 of at most 13')
    expect(progressLabel(4, 8)).toBe('4 answered, at most 8 still to come after this one')
  })

  it('give the count plainly on the last question of a round, when nothing can change it', () => {
    expect(stepLabel(13, 13)).toBe('Question 13 of 13')
    expect(stepLabel(1, 1)).toBe('Question 1 of 1')
    expect(progressLabel(12, 0)).toBe('12 answered, none still to come after this one')
  })

  it('say how many other open quests and tiers are not asked about, with the real number', () => {
    expect(setAsideNote(37)).toEqual({
      lead: '37 other quests and diary tiers are not asked about,',
      rest: 'because none of them would change your plan right now. Long Game asks again when one starts to matter, for example when you reach the level for a method it unlocks. The full tick list is there if you want it.',
    })
    expect(setAsideNote(1)?.lead).toBe('1 other quest or diary tier is not asked about,')
    expect(setAsideNote(1)?.rest).toMatch(/^because it would not change your plan right now\. /)
    expect(setAsideNote(0)).toBeNull()
  })
})

describe('questionsPrompt', () => {
  it('says how many questions are waiting and why they matter, in the singular and the plural', () => {
    expect(questionsPrompt(3)).toBe(
      'Up to 3 quick questions about your quests would sharpen tonight’s plan.',
    )
    expect(questionsPrompt(1)).toBe(
      '1 quick question about your quests would sharpen tonight’s plan.',
    )
  })
})

describe('the answers given this visit', () => {
  const ticks: QuestTicks = {
    completedQuests: ['Bone Voyage'],
    completedDiaries: ['Kandarin Easy'],
    declinedQuests: ['Sins of the Father'],
    declinedDiaries: ['Desert Hard'],
  }
  const given = [
    answer(quest('Bone Voyage'), true, 365),
    answer(quest('Sins of the Father'), false, 61),
    answer(diary('Kandarin Easy'), true),
    answer(diary('Desert Hard'), false, 0.6),
  ]

  it('stand while the account still says the same', () => {
    expect(answersStanding(given, ticks)).toEqual(given)
  })

  it('drop out once undone on the tick list: a yes unticked, a "not yet" ticked', () => {
    const undone: QuestTicks = {
      completedQuests: ['Sins of the Father'],
      completedDiaries: [],
      declinedQuests: [],
      declinedDiaries: ['Desert Hard'],
    }
    expect(answersStanding(given, undone)).toEqual([given[3]])
  })

  it('took off the hours their yeses saved, and nothing for a "not yet"', () => {
    expect(hoursTakenOff(given)).toBe(365)
    expect(hoursTakenOff([])).toBe(0)
  })
})

describe('answerRows', () => {
  const rows = answerRows(
    [
      answer(quest('Bone Voyage'), true, 364.6, ['Druidic Ritual', 'The Dig Site']),
      answer(quest('Perilous Moons'), false, 76.8),
      answer(diary('Kandarin Easy'), true, 0),
      answer(quest('Biohazard'), true, 0.75, ['Plague City']),
    ],
    [
      question(quest('Sins of the Father'), 60.6),
      question(quest('Dream Mentor'), 16.9),
      question(diary('Desert Hard'), 0.66),
      question(quest('Tears of Guthix'), 0),
    ],
  )

  it('lists the answers given, then the question on the card, then the ones to come', () => {
    expect(rows.map((row) => [row.name, row.state, row.stateLabel])).toEqual([
      ['Bone Voyage', 'done', 'Done'],
      ['Perilous Moons', 'not-yet', 'Not yet'],
      ['Kandarin Easy diary', 'done', 'Done'],
      ['Biohazard', 'done', 'Done'],
      ['Sins of the Father', 'asking', 'Asking now'],
      ['Dream Mentor', 'to-come', ''],
      ['Desert Hard diary', 'to-come', ''],
      ['Tears of Guthix', 'to-come', ''],
    ])
  })

  it('shows what a yes saved, and nothing for a "not yet" or a yes that saved no hours', () => {
    expect(rows.map((row) => row.saved)).toEqual(['−365 h', '', '', '−45 min', '', '', '', ''])
  })

  it('says what else a yes settled', () => {
    expect(rows.map((row) => row.note)).toEqual([
      'and 2 quests it requires',
      '',
      '',
      'and 1 quest it requires',
      '',
      '',
      '',
      '',
    ])
  })

  it('gives a question to come the most it may save, or says that it adds to the plan', () => {
    expect(rows.slice(4).map((row) => row.mayCome)).toEqual([
      '',
      'up to 17 h',
      'up to 40 min',
      'adds to your plan',
    ])
  })

  it('sizes each bar against the biggest saving still to come', () => {
    expect(rows.slice(4).map((row) => row.share)).toEqual([0, 100, 4, 0])
  })

  it('keys each row by what it is about, so a quest and a diary of one name stay apart', () => {
    expect(rows[0]?.key).toBe('quest:Bone Voyage')
    expect(rows[2]?.key).toBe('diary:Kandarin Easy')
  })

  it('is empty with no answers and no questions', () => {
    expect(answerRows([], [])).toEqual([])
  })
})

describe('answerAnnouncement', () => {
  it('says the answer, what else it ticked and the next question', () => {
    expect(
      answerAnnouncement(answer(quest('Bone Voyage'), true, 365, ['Druidic Ritual']), {
        question: question(quest('Perilous Moons'), 77),
        step: 2,
        total: 31,
      }),
    ).toBe(
      'Bone Voyage: done. Also ticked: Druidic Ritual. Question 2 of at most 31. Have you finished Perilous Moons?',
    )
  })

  it('says the pause between the rounds: the hours are right, and what is left', () => {
    expect(answerAnnouncement(answer(quest('Pandemonium'), false, 1.2), { smallerLeft: 16 })).toBe(
      'Pandemonium: not yet. Your hours to max are now right. 16 smaller questions are left. They add daily runs and alternative methods to your plan. They do not change your hours to max.',
    )
  })

  it('says a question by itself, for the start of the second round', () => {
    expect(
      questionAnnouncement({ question: question(quest('Tears of Guthix'), 0), step: 1, total: 16 }),
    ).toBe('Question 1 of at most 16. Have you finished Tears of Guthix?')
  })

  it('says a "not yet" and that nothing is left to ask', () => {
    expect(answerAnnouncement(answer(diary('Desert Hard'), false), null)).toBe(
      'Desert Hard diary: not yet. No more questions.',
    )
  })
})

describe('questionsDoneSummary', () => {
  it('says how many hours the answers took off', () => {
    expect(
      questionsDoneSummary([
        answer(quest('Bone Voyage'), true, 364.6),
        answer(quest('Sins of the Father'), false, 61),
        answer(quest('Vale Totems'), true, 67.2),
      ]),
    ).toBe('Your 3 answers took 432 hours off your hours to max.')
    expect(questionsDoneSummary([answer(quest('Bone Voyage'), true, 1)])).toBe(
      'Your 1 answer took 1 hour off your hours to max.',
    )
  })

  it('says so when the answers took no hours off', () => {
    expect(questionsDoneSummary([answer(quest('Tears of Guthix'), true, 0)])).toBe(
      'Your 1 answer took no hours off, but the plan now knows what it can deal you.',
    )
  })

  it('says there is nothing to ask when the visit brought no answers', () => {
    expect(questionsDoneSummary([])).toBe('Long Game has nothing to ask you right now.')
  })
})

describe('the tick list’s rows', () => {
  const ironman = accountWith({ type: 'iron', quests: ['Bone Voyage'] })

  it('show each unlocking quest with what it opens up, cut short, and the skills that trains', () => {
    expect(unlockRows(ironman, ['Bone Voyage', 'Temple of the Eye', 'Tears of Guthix'])).toEqual([
      {
        name: 'Bone Voyage',
        done: true,
        opens: 'Teak trees (1.5-tick), Sulliusceps and 9 more',
        skills: ['woodcutting', 'fishing', 'crafting', 'mining'],
        moreSkills: 2,
      },
      {
        name: 'Temple of the Eye',
        done: false,
        opens: 'Guardians of the Rift',
        skills: ['runecraft'],
        moreSkills: 0,
      },
      { name: 'Tears of Guthix', done: false, opens: 'Tears of Guthix', skills: [], moreSkills: 0 },
    ])
  })

  it('count a quest as done under the quest cape shortcut', () => {
    const [row] = unlockRows(accountWith({ allQuests: true }), ['Temple of the Eye'])
    expect(row?.done).toBe(true)
  })

  const quests: Quest[] = [
    {
      name: "Cook's Assistant",
      fixedXp: { cooking: 300 },
      skillLevelsNeeded: {},
      miniquest: false,
    },
    {
      name: 'Grim Tales',
      fixedXp: { farming: 4000, herblore: 5000 },
      lamps: { description: 'Lamps.', totalXp: 131_000 },
      skillLevelsNeeded: {},
      miniquest: false,
    },
  ]

  it('show every other quest with what it pays', () => {
    expect(questRows(accountWith({ quests: ['Grim Tales'] }), quests)).toEqual([
      { name: "Cook's Assistant", done: false, xp: '300' },
      { name: 'Grim Tales', done: true, xp: '140k' },
    ])
  })

  it('say how many are ticked', () => {
    expect(tickedCountLabel(questRows(accountWith({ quests: ['Grim Tales'] }), quests))).toBe(
      '1 of 2 ticked',
    )
  })
})

describe('filterQuestRows', () => {
  const rows = [
    { name: "Cook's Assistant", done: true },
    { name: 'Cold War', done: false },
    { name: 'Contact!', done: false },
  ]
  const names = (found: readonly { name: string }[]) => found.map((row) => row.name)

  it('shows everything with no search and no filter', () => {
    expect(filterQuestRows(rows, '', 'all')).toEqual(rows)
  })

  it('searches the names, whatever the capitals and the spaces round the text', () => {
    expect(names(filterQuestRows(rows, ' co ', 'all'))).toEqual([
      "Cook's Assistant",
      'Cold War',
      'Contact!',
    ])
    expect(names(filterQuestRows(rows, 'WAR', 'all'))).toEqual(['Cold War'])
    expect(filterQuestRows(rows, 'dragon', 'all')).toEqual([])
  })

  it('filters by done or not done, together with the search', () => {
    expect(names(filterQuestRows(rows, '', 'done'))).toEqual(["Cook's Assistant"])
    expect(names(filterQuestRows(rows, '', 'not-done'))).toEqual(['Cold War', 'Contact!'])
    expect(names(filterQuestRows(rows, 'cont', 'not-done'))).toEqual(['Contact!'])
    expect(filterQuestRows(rows, 'cont', 'done')).toEqual([])
  })
})
