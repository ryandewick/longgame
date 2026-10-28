import { describe, expect, it } from 'vitest'
import { readWindowPlace, SMALLEST_WINDOW } from '#shared/domain/window-place'

describe('readWindowPlace', () => {
  it('reads a window place as the page reports it', () => {
    expect(readWindowPlace({ x: 1660, y: 30, width: 900, height: 1300 })).toEqual({
      x: 1660,
      y: 30,
      width: 900,
      height: 1300,
    })
  })

  it('keeps only the four figures', () => {
    expect(readWindowPlace({ x: 0, y: 0, width: 960, height: 1300, extra: 'ignored' })).toEqual({
      x: 0,
      y: 0,
      width: 960,
      height: 1300,
    })
  })

  it('takes a maximised window, which sits a few pixels past the corner', () => {
    expect(readWindowPlace({ x: -8, y: -8, width: 2576, height: 1416 })).not.toBeNull()
  })

  it.each([
    ['nothing', null],
    ['text', 'window'],
    ['a list', [0, 0, 900, 1300]],
    ['a missing figure', { x: 0, y: 0, width: 900 }],
    ['a figure as text', { x: '0', y: 0, width: 900, height: 1300 }],
    ['a fraction', { x: 0.5, y: 0, width: 900, height: 1300 }],
    ['a minimised window, far off the screen', { x: -32000, y: -32000, width: 160, height: 28 }],
    ['a window too narrow to use', { x: 0, y: 0, width: SMALLEST_WINDOW.width - 1, height: 900 }],
    ['a window too short to use', { x: 0, y: 0, width: 900, height: SMALLEST_WINDOW.height - 1 }],
  ])('refuses %s', (_case, value) => {
    expect(readWindowPlace(value)).toBeNull()
  })
})
