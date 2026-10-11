import { describe, expect, it } from 'vitest'
import { skillStrip } from '~~/app/utils/skill-strip'

describe('skillStrip', () => {
  it('places the level along a line from 1 to 99', () => {
    expect(skillStrip(1, []).position).toBe(0)
    expect(skillStrip(50, []).position).toBe(50)
    expect(skillStrip(74, []).position).toBe(74.49)
    expect(skillStrip(99, []).position).toBe(100)
  })

  it('keeps a level beyond either end on the line', () => {
    expect(skillStrip(0, []).position).toBe(0)
    expect(skillStrip(120, []).position).toBe(100)
  })

  it('puts one stop at each level a method unlocks, lowest first', () => {
    const { stops } = skillStrip(40, [60, 15, 35, 35, 15])
    expect(stops.map((stop) => stop.level)).toEqual([15, 35, 60])
    expect(stops.map((stop) => stop.position)).toEqual([14.29, 34.69, 60.2])
  })

  it('leaves the two ends of the line without a stop', () => {
    expect(skillStrip(40, [1, 1, 99]).stops).toEqual([])
  })

  it('marks the stops the skill has reached, the one at its own level included', () => {
    const { stops } = skillStrip(35, [15, 35, 60])
    expect(stops.map((stop) => stop.reached)).toEqual([true, true, false])
  })

  it('says the level and the unlocks still ahead to a screen reader', () => {
    expect(skillStrip(74, [35, 35, 50, 60, 62, 75, 90]).label).toBe(
      'Level 74 of 99, 2 method unlocks ahead',
    )
    expect(skillStrip(99, [35, 50]).label).toBe('Level 99 of 99, 0 method unlocks ahead')
    expect(skillStrip(1, [1, 20]).label).toBe('Level 1 of 99, 1 method unlocks ahead')
  })
})
