import { describe, expect, it } from 'vitest'
import { isSameName, nameKey } from '#shared/domain/player-names'

describe('nameKey', () => {
  it('is the name in lower case, each run of anything but letters and digits one underscore', () => {
    expect(nameKey('Lynx Titan')).toBe('lynx_titan')
    expect(nameKey('lynx_titan')).toBe('lynx_titan')
    expect(nameKey('Lynx  -_Titan')).toBe('lynx_titan')
    expect(nameKey('Zezima')).toBe('zezima')
  })
})

describe('isSameName', () => {
  it('ignores case, and treats a space and an underscore alike, as the game does', () => {
    expect(isSameName('Lynx Titan', 'lynx_titan')).toBe(true)
    expect(isSameName('ZEZIMA', 'zezima')).toBe(true)
  })

  it('tells different names apart', () => {
    expect(isSameName('Zezima', 'Zezima2')).toBe(false)
    expect(isSameName('Lynx Titan', 'LynxTitan')).toBe(false)
  })
})
