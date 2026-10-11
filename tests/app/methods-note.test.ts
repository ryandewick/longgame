import { describe, expect, it } from 'vitest'
import { methodsNote } from '~~/app/utils/methods-note'

describe('methodsNote', () => {
  it('says on the website that the list is not complete, and offers the suggestion form', () => {
    expect(methodsNote(true)).toEqual({
      text: 'This list is not complete. Every method here was checked against the Old School RuneScape Wiki, and some good ones will be missing. If you know one, suggest it and it will be checked and added.',
      suggestLabel: 'Suggest a method',
    })
  })

  it('promises nothing on a local copy, which has no form', () => {
    expect(methodsNote(false)).toEqual({
      text: 'This list is not complete. Every method here was checked against the Old School RuneScape Wiki, and some good ones will be missing.',
      suggestLabel: null,
    })
  })
})
