import { describe, expect, it } from 'vitest'
import { skillsInPlay, skillsWithMethod } from '#shared/domain/planner'
import {
  MOOD_OPTIONS,
  SESSION_LENGTHS,
  capesToFan,
  dealSummary,
  moodHelp,
  moodRelaxedMessage,
  nothingToSwapMessage,
  sessionLengthLabel,
  skillsForMood,
  type DealOutlook,
} from '~~/app/utils/tonight-deal'
import { accountWith } from '../domain/helpers'

describe('the session lengths', () => {
  it('run from half an hour to four hours', () => {
    expect(SESSION_LENGTHS.map(sessionLengthLabel)).toEqual([
      '30 min',
      '1 h',
      '1.5 h',
      '2 h',
      '3 h',
      '4 h',
    ])
  })
})

describe('the moods', () => {
  it('are offered balanced first', () => {
    expect(MOOD_OPTIONS.map((option) => option.label)).toEqual([
      'Balanced',
      'AFK tonight',
      'Full attention',
    ])
  })

  it('each say what they do to a session', () => {
    expect(moodHelp('balanced')).toBe('Alternates AFK and active blocks.')
    expect(moodHelp('afk')).toBe('Every block is an AFK method.')
    expect(moodHelp('active')).toBe('Every block is an active method.')
  })
})

describe('skillsForMood', () => {
  const account = accountWith({ everySkill: 60, levels: { thieving: 99 } })

  it('is every skill with something to grind on a balanced night', () => {
    expect(skillsForMood(account, 'balanced')).toEqual(skillsInPlay(account))
  })

  it('is only the skills with a method of the intensity on a strict night', () => {
    expect(skillsForMood(account, 'afk')).toEqual(skillsWithMethod(account, ['afk']))
    expect(skillsForMood(account, 'active')).toEqual(skillsWithMethod(account, ['active']))
  })

  it('never offers a skill that is already 99', () => {
    expect(skillsForMood(account, 'balanced')).not.toContain('thieving')
  })
})

describe('capesToFan', () => {
  const account = accountWith({
    everySkill: 50,
    levels: { fishing: 85, firemaking: 85, runecraft: 85, hunter: 80, thieving: 99 },
  })

  it('takes the three highest of the skills on offer, highest first', () => {
    expect(capesToFan(account, ['hunter', 'mining', 'runecraft', 'fishing'])).toEqual([
      'runecraft',
      'fishing',
      'hunter',
    ])
  })

  it('keeps the order it was given between skills at the same level', () => {
    expect(capesToFan(account, ['fishing', 'firemaking', 'runecraft', 'hunter'])).toEqual([
      'fishing',
      'firemaking',
      'runecraft',
    ])
  })

  it('fans fewer than three when fewer are on offer', () => {
    expect(capesToFan(account, ['mining'])).toEqual(['mining'])
  })

  it('falls back to the whole account when the mood leaves nothing to deal', () => {
    expect(capesToFan(account, [])).toEqual(['thieving', 'fishing', 'firemaking'])
  })
})

describe('dealSummary', () => {
  const outlook: DealOutlook = {
    skillCount: 21,
    mood: 'balanced',
    minutes: 90,
    includeResets: true,
    includeWildcard: true,
  }

  it('counts the skills in play on a balanced night', () => {
    expect(dealSummary(outlook)).toBe('21 skills in play, resets included, one wildcard')
  })

  it('counts the skills with a fitting method on a strict night', () => {
    expect(dealSummary({ ...outlook, mood: 'active', skillCount: 14 })).toBe(
      '14 skills with an active method, resets included, one wildcard',
    )
    expect(dealSummary({ ...outlook, mood: 'afk', skillCount: 9 })).toBe(
      '9 skills with an AFK method, resets included, no wildcard on an AFK night',
    )
  })

  it('says when resets are switched off', () => {
    expect(dealSummary({ ...outlook, includeResets: false })).toBe(
      '21 skills in play, resets off, one wildcard',
    )
  })

  it('says why there is no wildcard', () => {
    expect(dealSummary({ ...outlook, includeWildcard: false })).toContain(', no wildcard')
    expect(dealSummary({ ...outlook, minutes: 60 })).toContain(', wildcard from 90 min up')
    // switched off beats every other reason
    expect(dealSummary({ ...outlook, includeWildcard: false, mood: 'afk', minutes: 30 })).toBe(
      '21 skills with an AFK method, resets included, no wildcard',
    )
  })
})

describe('moodRelaxedMessage', () => {
  it('names the mood that could not be kept', () => {
    expect(moodRelaxedMessage('afk')).toBe(
      'Nothing AFK is open to this account yet, so this session mixes in other blocks.',
    )
    expect(moodRelaxedMessage('active')).toBe(
      'Nothing active is open to this account yet, so this session mixes in other blocks.',
    )
  })

  it('has nothing to say about a balanced night', () => {
    expect(moodRelaxedMessage('balanced')).toBeNull()
  })
})

describe('nothingToSwapMessage', () => {
  it('names the intensity the slot was dealt for', () => {
    expect(nothingToSwapMessage(['afk'])).toBe('Nothing else AFK to swap in.')
    expect(nothingToSwapMessage(['semi'])).toBe('Nothing else Semi-AFK to swap in.')
    expect(nothingToSwapMessage(['active'])).toBe('Nothing else active to swap in.')
  })

  it('names none when the slot would take several', () => {
    expect(nothingToSwapMessage(['afk', 'semi'])).toBe('Nothing else to swap in.')
    expect(nothingToSwapMessage([])).toBe('Nothing else to swap in.')
  })
})
