import { describe, expect, it } from 'vitest'
import { METHODS } from '#shared/data/methods'
import { SKILL_KEYS } from '#shared/data/skills'
import {
  blankSuggestion,
  SUGGESTABLE_SKILLS,
  SUGGESTION_WIKI_PATTERN,
  type SuggestionDraft,
} from '~~/app/utils/suggestion'
import {
  isHoneypotFilled,
  parseSuggestion,
  SUGGESTION_SKILLS as SKILLS_THE_SERVER_TAKES,
} from '~~/server/utils/suggestion'

/** The form filled in the way a player would fill it. */
function filledDraft(changes: Partial<SuggestionDraft> = {}): SuggestionDraft {
  return {
    ...blankSuggestion('mining'),
    level: 72,
    name: 'Volcanic Mine',
    wiki: 'https://oldschool.runescape.wiki/w/Volcanic_Mine',
    ...changes,
  }
}

/** The draft as the server receives it: turned to JSON and back. */
const asReceived = (draft: SuggestionDraft) => JSON.parse(JSON.stringify(draft))

/** A browser checks a `pattern` against the whole value. */
const wikiPattern = new RegExp(`^(?:${SUGGESTION_WIKI_PATTERN})$`)

describe('SUGGESTABLE_SKILLS', () => {
  it('offers exactly the skills the server takes suggestions for, in the same order', () => {
    expect(SUGGESTABLE_SKILLS).toEqual([...SKILLS_THE_SERVER_TAKES])
  })

  it('is every skill that has methods of its own', () => {
    expect(SUGGESTABLE_SKILLS).toEqual(SKILL_KEYS.filter((skill) => METHODS[skill].length > 0))
  })
})

describe('blankSuggestion', () => {
  it('starts on the skill the player was looking at, with nothing else filled in', () => {
    expect(blankSuggestion('ranged')).toEqual({
      skill: 'ranged',
      level: '',
      name: '',
      xpPerHour: '',
      intensity: 'afk',
      audience: 'both',
      wiki: '',
      notes: '',
      website: '',
    })
  })

  it('starts on the first skill that takes suggestions when the one asked for takes none', () => {
    expect(blankSuggestion('hitpoints').skill).toBe('attack')
  })

  it('leaves the skill for the player to pick when the form opens from a list that spans skills', () => {
    expect(blankSuggestion(null)).toEqual({ ...blankSuggestion('mining'), skill: '' })
  })

  it('is refused by the server while no skill is picked, however much else is filled in', () => {
    expect(parseSuggestion(asReceived(filledDraft({ skill: '' })))).toMatchObject({ ok: false })
  })

  it('is refused by the server until it is filled in', () => {
    expect(parseSuggestion(asReceived(blankSuggestion('mining')))).toMatchObject({ ok: false })
  })
})

describe('a filled-in draft', () => {
  it('is what the server reads, field for field', () => {
    const draft = filledDraft({
      xpPerHour: 85_000,
      intensity: 'active',
      audience: 'iron',
      notes: 'Needs 150 Kudos.',
    })
    expect(parseSuggestion(asReceived(draft))).toEqual({
      ok: true,
      value: {
        skill: 'mining',
        level: 72,
        name: 'Volcanic Mine',
        xpPerHour: 85_000,
        intensity: 'active',
        audience: 'iron',
        wiki: 'https://oldschool.runescape.wiki/w/Volcanic_Mine',
        notes: 'Needs 150 Kudos.',
      },
    })
  })

  it('is accepted with the optional boxes left empty', () => {
    expect(parseSuggestion(asReceived(filledDraft()))).toMatchObject({
      ok: true,
      value: { xpPerHour: 0, notes: '' },
    })
  })

  it('does not trip the honeypot unless something filled the hidden box', () => {
    expect(isHoneypotFilled(asReceived(filledDraft()))).toBe(false)
    expect(isHoneypotFilled(asReceived(filledDraft({ website: 'https://spam.example' })))).toBe(
      true,
    )
  })
})

describe('SUGGESTION_WIKI_PATTERN', () => {
  it('takes a page on the Old School RuneScape Wiki', () => {
    expect(wikiPattern.test('https://oldschool.runescape.wiki/w/Volcanic_Mine')).toBe(true)
  })

  it('refuses any other address', () => {
    expect(wikiPattern.test('https://oldschool.runescape.wiki/')).toBe(false)
    expect(wikiPattern.test('http://oldschool.runescape.wiki/w/Mining')).toBe(false)
    expect(wikiPattern.test('https://oldschoolxrunescape.wiki/w/Mining')).toBe(false)
    expect(wikiPattern.test('https://runescape.wiki/w/Mining')).toBe(false)
    expect(wikiPattern.test('https://example.com/?https://oldschool.runescape.wiki/w/Mining')).toBe(
      false,
    )
  })
})
