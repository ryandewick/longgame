import { describe, expect, it } from 'vitest'
import { parsePlayerName } from '~~/server/utils/player-name'

const NOT_A_NAME = { statusCode: 400, message: 'That does not look like a RuneScape name.' }
const NO_NAME = { statusCode: 400, message: 'no name' }

describe('parsePlayerName', () => {
  it.each(['Zezima', 'a', 'Iron Man 99', 'under_score', 'hy-phen', '123456789012'])(
    'accepts %j',
    (name) => {
      expect(parsePlayerName(name)).toEqual({ ok: true, value: name })
    },
  )

  it('trims the name before checking and returning it', () => {
    expect(parsePlayerName('  Zezima ')).toEqual({ ok: true, value: 'Zezima' })
  })

  it.each([undefined, null, '', '   ', 42, ['Zezima', 'Lynx Titan']])(
    'answers "no name" for %j',
    (input) => {
      expect(parsePlayerName(input)).toEqual({ ok: false, failure: NO_NAME })
    },
  )

  it.each([
    ['thirteen characters', '1234567890123'],
    ['markup', '<script>'],
    ['a path', '../state'],
    ['a query', 'a&player=b'],
    ['an accented letter', 'Zézima'],
    ['a line break inside', 'a\nb'],
  ])('refuses %s', (_reason, name) => {
    expect(parsePlayerName(name)).toEqual({ ok: false, failure: NOT_A_NAME })
  })
})
