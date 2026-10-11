/*
 * The note that goes with a list of training methods, on the Methods page and on the guides: the
 * list is not complete, and here is how a method gets added. On the website that is the
 * suggestion form; a copy on a player's own machine has no form, so it only says the list is
 * not complete.
 */

/** What the note says, and the one way it offers to get a method added. */
export interface MethodsNote {
  /** The sentences every copy shows. */
  readonly text: string
  /** The words of the button that opens the suggestion form; null where there is no form. */
  readonly suggestLabel: string | null
}

const NOT_COMPLETE =
  'This list is not complete. Every method here was checked against the Old School RuneScape Wiki, and some good ones will be missing.'

/** The note for this copy. `takesSuggestions` is true on the website, which files suggestions. */
export function methodsNote(takesSuggestions: boolean): MethodsNote {
  if (!takesSuggestions) return { text: NOT_COMPLETE, suggestLabel: null }
  return {
    text: `${NOT_COMPLETE} If you know one, suggest it and it will be checked and added.`,
    suggestLabel: 'Suggest a method',
  }
}
