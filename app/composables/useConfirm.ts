/** A question put to the player before something that cannot be undone. */
export interface ConfirmRequest {
  readonly title: string
  readonly body: string
  /** What the button that goes ahead says. 'Confirm' when left out. */
  readonly confirmLabel?: string
}

// The promise of the question on screen is settled from the dialog. A function cannot live in
// `useState` (the state is serialised into the page), so it is kept here; only the browser sets it.
let settle: ((confirmed: boolean) => void) | undefined

/**
 * Asks the player to confirm something. `confirm` resolves true when they go ahead and false
 * when they cancel, press Escape or click outside. `ConfirmDialog` (in the default layout) draws
 * the question and calls `answer`. Asking again while a question is open cancels the first.
 */
export function useConfirm(): {
  request: Readonly<Ref<ConfirmRequest | null>>
  confirm: (request: ConfirmRequest) => Promise<boolean>
  answer: (confirmed: boolean) => void
} {
  const request = useState<ConfirmRequest | null>('confirm-request', () => null)

  function answer(confirmed: boolean): void {
    request.value = null
    settle?.(confirmed)
    settle = undefined
  }

  function confirm(question: ConfirmRequest): Promise<boolean> {
    if (!import.meta.client) return Promise.resolve(false)
    answer(false)
    request.value = question
    return new Promise((resolve) => {
      settle = resolve
    })
  }

  return { request: readonly(request), confirm, answer }
}
