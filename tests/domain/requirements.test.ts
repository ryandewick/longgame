import { describe, expect, it } from 'vitest'
import {
  NO_REQUIREMENTS,
  describeMissingRequirement,
  meetsRequirements,
  missingRequirements,
  parseRequirements,
  requirementProblems,
} from '#shared/domain/requirements'
import { accountWith } from './helpers'

describe('parseRequirements', () => {
  it('reads nothing from an empty string', () => {
    expect(parseRequirements('')).toEqual(NO_REQUIREMENTS)
  })

  it('reads quests, skills, diaries and combat level', () => {
    expect(
      parseRequirements(
        'q:Bone Voyage|Dragon Slayer I;s:fishing 50,agility 60;d:Ardougne Medium;c:70',
      ),
    ).toEqual({
      quests: ['Bone Voyage', 'Dragon Slayer I'],
      skills: [
        { skill: 'fishing', level: 50 },
        { skill: 'agility', level: 60 },
      ],
      diaries: ['Ardougne Medium'],
      combatLevel: 70,
    })
  })

  it('keeps apostrophes, ampersands and dots in names', () => {
    const parsed = parseRequirements("q:Between a Rock...|Eagles' Peak;d:Kourend & Kebos Hard")
    expect(parsed.quests).toEqual(['Between a Rock...', "Eagles' Peak"])
    expect(parsed.diaries).toEqual(['Kourend & Kebos Hard'])
  })

  it('tolerates spaces around a skill entry', () => {
    expect(parseRequirements('s: mining  72 , smithing 30').skills).toEqual([
      { skill: 'mining', level: 72 },
      { skill: 'smithing', level: 30 },
    ])
  })

  it('leaves out what it cannot read', () => {
    expect(parseRequirements('nonsense;s:mining seventy,dancing 5,cooking 30;x:1;c:high')).toEqual({
      ...NO_REQUIREMENTS,
      skills: [{ skill: 'cooking', level: 30 }],
    })
  })

  it('keeps a repeated skill in its first place with the later level', () => {
    expect(parseRequirements('s:mining 10,cooking 5,mining 20').skills).toEqual([
      { skill: 'mining', level: 20 },
      { skill: 'cooking', level: 5 },
    ])
  })
})

describe('requirementProblems', () => {
  it('finds nothing wrong with sound strings', () => {
    expect(requirementProblems('')).toEqual([])
    expect(requirementProblems('q:Bone Voyage;s:hunter 5')).toEqual([])
    expect(requirementProblems('d:Lumbridge & Draynor Elite;c:126')).toEqual([])
  })

  it.each([
    ['a part with no type', 'Bone Voyage', /bad requirement part/],
    ['an unknown type', 'z:whatever', /unknown requirement type 'z'/],
    ['a skill that does not exist', 's:dancing 50', /bad skill requirement/],
    ['a level above 99', 's:mining 100', /bad skill requirement/],
    ['a level of zero', 's:mining 0', /bad skill requirement/],
    ['a level in words', 's:mining ten', /bad skill requirement/],
    ['a diary region that does not exist', 'd:Lumbridge Medium', /bad diary requirement/],
    ['a diary tier that does not exist', 'd:Ardougne Master', /bad diary requirement/],
    ['a combat level below 3', 'c:2', /bad combat requirement/],
    ['a combat level above 126', 'c:127', /bad combat requirement/],
    ['a combat level in words', 'c:high', /bad combat requirement/],
    ['a colon inside a name', 'q:Recipe for Disaster: Another Cook', /colon inside/],
    ['the same type twice', 'q:Bone Voyage;q:Dragon Slayer I', /appears twice/],
    ['an empty quest name', 'q:Bone Voyage|', /empty quest name/],
  ])('reports %s', (_case, text, problem) => {
    expect(requirementProblems(text).join('\n')).toMatch(problem)
  })
})

describe('missingRequirements', () => {
  const requirements = parseRequirements(
    'q:Bone Voyage|Dragon Slayer I;s:fishing 50,agility 60;d:Ardougne Medium;c:70',
  )

  it('lists everything a new account lacks, in a fixed order', () => {
    const missing = missingRequirements(accountWith(), requirements)
    expect(missing.map(describeMissingRequirement)).toEqual([
      'Bone Voyage',
      'Dragon Slayer I',
      '50 Fishing',
      '60 Agility',
      'Ardougne Medium diary',
      '70 combat',
    ])
  })

  it('lists nothing once everything is met', () => {
    const account = accountWith({
      everySkill: 70,
      quests: ['Bone Voyage', 'Dragon Slayer I'],
      diaries: ['Ardougne Medium'],
    })
    expect(missingRequirements(account, requirements)).toEqual([])
    expect(meetsRequirements(account, requirements)).toBe(true)
  })

  it('lists only what is still missing', () => {
    const account = accountWith({ everySkill: 50, quests: ['Bone Voyage'] })
    expect(missingRequirements(account, requirements)).toEqual([
      { kind: 'quest', quest: 'Dragon Slayer I' },
      { kind: 'skill', skill: 'agility', level: 60 },
      { kind: 'diary', diary: 'Ardougne Medium' },
      { kind: 'combat', level: 70 },
    ])
  })

  it('takes the quest cape and diary cape shortcuts at their word', () => {
    const account = accountWith({ everySkill: 70, allQuests: true, allDiaries: true })
    expect(missingRequirements(account, requirements)).toEqual([])
  })

  it('needs every quest in the list, not just one', () => {
    const account = accountWith({ quests: ['Dragon Slayer I'] })
    expect(meetsRequirements(account, parseRequirements('q:Bone Voyage|Dragon Slayer I'))).toBe(
      false,
    )
  })
})

describe('meetsRequirements with an assumed level', () => {
  const requirements = parseRequirements('s:mining 60,smithing 40')

  it('takes the one skill at the level asked about', () => {
    const account = accountWith({ levels: { smithing: 40 } })
    expect(meetsRequirements(account, requirements)).toBe(false)
    expect(meetsRequirements(account, requirements, { skill: 'mining', level: 60 })).toBe(true)
    expect(meetsRequirements(account, requirements, { skill: 'mining', level: 59 })).toBe(false)
  })

  it('leaves every other skill as the account has it', () => {
    const account = accountWith()
    expect(meetsRequirements(account, requirements, { skill: 'mining', level: 99 })).toBe(false)
  })

  it('does not raise the combat level along with the assumed skill', () => {
    const account = accountWith()
    const combat = parseRequirements('c:50')
    expect(meetsRequirements(account, combat, { skill: 'strength', level: 99 })).toBe(false)
  })
})

describe('describeMissingRequirement', () => {
  it('names the Grand Exchange for a method an ironman cannot supply', () => {
    expect(describeMissingRequirement({ kind: 'grand-exchange' })).toBe('the Grand Exchange')
  })
})
