import { describe, expect, it } from 'vitest'
import type { JsonRecord } from '~~/server/utils/json'
import {
  buildSuggestionIssue,
  isHoneypotFilled,
  parseSuggestion,
  sanitiseText,
  SUGGESTION_SKILLS,
  type Suggestion,
} from '~~/server/utils/suggestion'

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)

/** A form submission that passes every check, as the browser sends it (form values arrive as text). */
function validBody(changes: JsonRecord = {}): JsonRecord {
  return {
    skill: 'mining',
    level: '72',
    name: 'Volcanic Mine',
    xpPerHour: '85000',
    intensity: 'active',
    audience: 'both',
    wiki: 'https://oldschool.runescape.wiki/w/Volcanic_Mine',
    notes: 'Needs 150 Kudos.',
    website: '',
    ...changes,
  }
}

function refusal(changes: JsonRecord): unknown {
  const result = parseSuggestion(validBody(changes))
  return result.ok ? 'accepted' : result.failure
}

describe('sanitiseText', () => {
  it('replaces control characters with spaces', () => {
    expect(sanitiseText('one\u0000two\u001fthree\u007ffour\u0085five', 80)).toBe(
      'one two three four five',
    )
  })

  it('turns markup characters into apostrophes', () => {
    expect(sanitiseText('<img src=x> and `code`', 80)).toBe("'img src=x' and 'code'")
  })

  it('breaks mentions with a zero-width space', () => {
    expect(sanitiseText('thanks @octocat', 80)).toBe(`thanks @${ZERO_WIDTH_SPACE}octocat`)
  })

  it('collapses white space, including line breaks, and trims', () => {
    expect(sanitiseText('  three\n\n  tick \t mining  ', 80)).toBe('three tick mining')
  })

  it('cuts to the maximum length after cleaning', () => {
    expect(sanitiseText('   abcdefgh', 5)).toBe('abcde')
  })

  it.each([undefined, null, 42, {}, ['text']])('reads %j as empty', (input) => {
    expect(sanitiseText(input, 80)).toBe('')
  })
})

describe('isHoneypotFilled', () => {
  it('is false when the hidden field is empty or absent', () => {
    expect(isHoneypotFilled({ website: '' })).toBe(false)
    expect(isHoneypotFilled({})).toBe(false)
  })

  it('is true when a bot has filled the hidden field', () => {
    expect(isHoneypotFilled({ website: 'https://spam.example' })).toBe(true)
  })
})

describe('parseSuggestion', () => {
  it('accepts a complete suggestion and returns it typed and cleaned', () => {
    expect(parseSuggestion(validBody())).toEqual({
      ok: true,
      value: {
        skill: 'mining',
        level: 72,
        name: 'Volcanic Mine',
        xpPerHour: 85000,
        intensity: 'active',
        audience: 'both',
        wiki: 'https://oldschool.runescape.wiki/w/Volcanic_Mine',
        notes: 'Needs 150 Kudos.',
      },
    })
  })

  it('accepts every skill that has methods, and not hitpoints', () => {
    for (const skill of SUGGESTION_SKILLS) expect(refusal({ skill })).toBe('accepted')
    expect(SUGGESTION_SKILLS).toHaveLength(23)
    expect(SUGGESTION_SKILLS).not.toContain('hitpoints')
  })

  it.each([undefined, '', 'hitpoints', 'Mining', 7])('refuses the skill %j', (skill) => {
    expect(refusal({ skill })).toEqual({ statusCode: 400, message: 'Pick a skill.' })
  })

  it.each([1, 99, '1', '99'])('accepts the level %j', (level) => {
    expect(refusal({ level })).toBe('accepted')
  })

  it.each([undefined, '', 0, 100, 50.5, 'ninety', true, [50]])('refuses the level %j', (level) => {
    expect(refusal({ level })).toEqual({
      statusCode: 400,
      message: 'The level has to be between 1 and 99.',
    })
  })

  it('refuses a name shorter than three characters once cleaned', () => {
    const expected = { statusCode: 400, message: 'Give the method a name.' }
    expect(refusal({ name: undefined })).toEqual(expected)
    expect(refusal({ name: ' ab \n' })).toEqual(expected)
  })

  it('cleans the name and the notes and cuts them to length', () => {
    const result = parseSuggestion(
      validBody({ name: `<b>@mod</b> ${'n'.repeat(100)}`, notes: 'x'.repeat(700) }),
    )
    expect(result.ok && result.value.name).toBe(`'b'@${ZERO_WIDTH_SPACE}mod'/b' ${'n'.repeat(67)}`)
    expect(result.ok && result.value.name).toHaveLength(80)
    expect(result.ok && result.value.notes).toHaveLength(600)
  })

  it.each([undefined, null, ''])('reads the XP an hour %j as not given', (xpPerHour) => {
    const result = parseSuggestion(validBody({ xpPerHour }))
    expect(result.ok && result.value.xpPerHour).toBe(0)
  })

  it.each([0, 2_000_000, '1234.5'])('accepts the XP an hour %j', (xpPerHour) => {
    expect(refusal({ xpPerHour })).toBe('accepted')
  })

  it.each([-1, 2_000_001, 'lots', 'Infinity', false])('refuses the XP an hour %j', (xpPerHour) => {
    expect(refusal({ xpPerHour })).toEqual({
      statusCode: 400,
      message: 'That XP an hour does not look right.',
    })
  })

  it.each([
    { intensity: 'relaxed' },
    { intensity: undefined },
    { audience: 'everyone' },
    { audience: undefined },
    // names every object inherits must not pass as a choice
    { intensity: 'constructor' },
    { audience: 'toString' },
  ])('refuses the choice %j', (changes) => {
    expect(refusal(changes)).toEqual({
      statusCode: 400,
      message: 'Something in the form is missing.',
    })
  })

  it.each([
    ['missing', undefined],
    ['another site', 'https://example.com/w/Mining'],
    ['plain http', 'http://oldschool.runescape.wiki/w/Mining'],
    ['a look-alike host', 'https://oldschool.runescape.wiki.example.com/w/Mining'],
    ['no page', 'https://oldschool.runescape.wiki/'],
    ['white space inside', 'https://oldschool.runescape.wiki/w/Mining training'],
    ['markup inside', 'https://oldschool.runescape.wiki/w/<script>'],
    ['a quote inside', 'https://oldschool.runescape.wiki/w/"x'],
    ['too long', `https://oldschool.runescape.wiki/${'a'.repeat(181)}`],
  ])('refuses a wiki link that is %s', (_reason, wiki) => {
    expect(refusal({ wiki })).toEqual({
      statusCode: 400,
      message: 'Add a link to the method on the Old School RuneScape Wiki.',
    })
  })

  it('trims the wiki link', () => {
    const result = parseSuggestion(
      validBody({ wiki: '  https://oldschool.runescape.wiki/w/Mining ' }),
    )
    expect(result.ok && result.value.wiki).toBe('https://oldschool.runescape.wiki/w/Mining')
  })

  it('reports the first problem only', () => {
    expect(refusal({ skill: 'nope', level: 0, name: '', wiki: '' })).toEqual({
      statusCode: 400,
      message: 'Pick a skill.',
    })
  })
})

describe('buildSuggestionIssue', () => {
  const suggestion: Suggestion = {
    skill: 'mining',
    level: 72,
    name: 'Volcanic Mine',
    xpPerHour: 85000.4,
    intensity: 'semi',
    audience: 'iron',
    wiki: 'https://oldschool.runescape.wiki/w/Volcanic_Mine',
    notes: 'Needs 150 Kudos.',
  }

  it('writes the issue the maintainers review', () => {
    expect(buildSuggestionIssue(suggestion)).toEqual({
      title: '[Method] Mining 72: Volcanic Mine',
      body: [
        '**Skill:** mining',
        '**Level:** 72',
        '**Method:** Volcanic Mine',
        '**XP an hour:** 85,000',
        '**Attention:** Semi-AFK',
        '**Works for:** Ironmen only',
        '**Wiki:** https://oldschool.runescape.wiki/w/Volcanic_Mine',
        '',
        '**Notes:** Needs 150 Kudos.',
        '',
        '_Sent from the suggestion form. Check it against the wiki before adding it to datasrc._',
      ].join('\n'),
      labels: ['method suggestion'],
    })
  })

  it('says so when the rate and the notes were left out', () => {
    const { body } = buildSuggestionIssue({ ...suggestion, xpPerHour: 0, notes: '' })
    expect(body).toContain('**XP an hour:** not given')
    expect(body).toContain('**Notes:** none')
  })
})
