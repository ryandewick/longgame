import { describe, expect, it } from 'vitest'
import { forEverySkill, SKILL_KEYS } from '#shared/data/skills'
import { blankSave, newAccountSave, type SavedHiscores } from '#shared/domain/save'
import { xpForLevel } from '#shared/domain/xp'
import { accountButtonLabel, accountRows, accountStatus } from '~~/app/utils/account-list'

const NOW = 1_800_000_000_000
const MINUTE = 60_000

/** Stats with every skill at 60, but Thieving at 99 and Fishing and Firemaking at 85. */
function stats(fetchedAt = NOW): SavedHiscores {
  const skills = forEverySkill((skill) => {
    const level =
      skill === 'thieving' ? 99 : skill === 'fishing' || skill === 'firemaking' ? 85 : 60
    return { level, xp: xpForLevel(level) + (skill === 'fishing' ? 1000 : 0) }
  })
  const totalLevel = SKILL_KEYS.reduce((sum, skill) => sum + skills[skill].level, 0)
  return { fetchedAt, skills, totalLevel, totalXp: 0 }
}

describe('accountRows', () => {
  it('lists every account in order, the open one marked', () => {
    const rows = accountRows(
      [newAccountSave('kodify', stats(), 'iron'), newAccountSave('Bankstander', stats(), 'main')],
      0,
      NOW,
    )
    expect(rows.map((row) => [row.name, row.kind, row.isOpen])).toEqual([
      ['kodify', 'Ironman', true],
      ['Bankstander', 'Main', false],
    ])
  })

  it("shows each account by its three highest capes, the highest last and a 99's trimmed", () => {
    const [row] = accountRows([newAccountSave('kodify', stats(), 'iron')], 0, NOW)
    expect(row?.capes).toEqual([
      { skill: 'firemaking', trimmed: false },
      { skill: 'fishing', trimmed: false },
      { skill: 'thieving', trimmed: true },
    ])
  })

  it('writes the total level as the game does, and says the whole row in words', () => {
    const [open, other] = accountRows(
      [newAccountSave('kodify', stats(), 'iron'), newAccountSave('Bankstander', stats(), null)],
      0,
      NOW,
    )
    expect(open?.totalLevel).toBe('1,529')
    expect(open?.label).toBe('kodify, Ironman, total level 1,529, open now')
    // until the lookup has said, an account is planned as a main
    expect(other?.label).toBe('Bankstander, Main, total level 1,529')
  })

  it('says under each name its kind and how fresh its stats are', () => {
    const [iron, main] = accountRows(
      [
        newAccountSave('kodify', stats(NOW - 5 * MINUTE), 'iron'),
        newAccountSave('Bankstander', stats(NOW), 'main'),
      ],
      0,
      NOW,
    )
    expect(iron?.detail).toBe('Ironman, stats 5 min ago')
    expect(main?.detail).toBe('Main, stats just now')
  })

  it('leaves out what an account that never loaded has not got', () => {
    const [row] = accountRows([{ ...blankSave(), name: 'Zezlma' }], null, NOW)
    expect(row).toEqual({
      name: 'Zezlma',
      kind: 'Main',
      detail: 'Main',
      totalLevel: '',
      capes: [],
      isOpen: false,
      label: 'Zezlma, Main',
    })
  })
})

describe('accountStatus', () => {
  it('says how fresh the stats are, and that the account is an ironman when it is', () => {
    expect(accountStatus('iron', stats(NOW - 5 * MINUTE), NOW)).toBe('Ironman, stats 5 min ago')
    expect(accountStatus('main', stats(NOW), NOW)).toBe('stats just now')
    expect(accountStatus(null, stats(NOW), NOW)).toBe('stats just now')
  })

  it('says nothing before the first lookup', () => {
    expect(accountStatus('iron', null, NOW)).toBe('')
  })
})

describe('accountButtonLabel', () => {
  it('leads with what the button shows, then says what it opens', () => {
    expect(accountButtonLabel('kodify', 'Ironman, stats 5 min ago')).toBe(
      'kodify, Ironman, stats 5 min ago. Your accounts',
    )
    expect(accountButtonLabel('Zezima', '')).toBe('Zezima. Your accounts')
  })
})
