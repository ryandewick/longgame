import { describe, expect, it } from 'vitest'
import { methodsNote } from '~~/app/utils/methods-note'

describe('methodsNote', () => {
  it('says on the website that the list is not complete, and offers the suggestion form', () => {
    expect(methodsNote(true, 'someone/longgame')).toEqual({
      text: 'This list is not complete. Every method here was checked against the Old School RuneScape Wiki, and some good ones will be missing. If you know one, suggest it and it will be checked and added.',
      suggestLabel: 'Suggest a method',
      link: null,
    })
  })

  it('points a local copy, which has no form, at the project’s issues', () => {
    expect(methodsNote(false, 'someone/longgame')).toEqual({
      text: 'This list is not complete. Every method here was checked against the Old School RuneScape Wiki, and some good ones will be missing. If you know one, it will be checked and added.',
      suggestLabel: null,
      link: { label: 'Suggest it on GitHub', href: 'https://github.com/someone/longgame/issues' },
    })
  })

  it('promises nothing where there is neither a form nor a repository', () => {
    expect(methodsNote(false, '')).toEqual({
      text: 'This list is not complete. Every method here was checked against the Old School RuneScape Wiki, and some good ones will be missing.',
      suggestLabel: null,
      link: null,
    })
  })
})
