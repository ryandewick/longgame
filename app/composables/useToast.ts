/** A short message from the app, shown in the game's parchment dialog at the foot of the page. */
export interface Toast {
  readonly message: string
  /** A few words set in bold before the message. */
  readonly lead: string | null
}

/** How long a toast stays up. */
const TOAST_MILLISECONDS = 3600

// One timer for the one toast there can be. Only the browser ever starts it.
let dismissTimer: number | undefined

/**
 * Shows a toast, and the toast that is showing. There is one at a time: a new one replaces the
 * old. `ToastHost` (in the default layout) draws it and announces it to screen readers.
 */
export function useToast(): {
  toast: Readonly<Ref<Toast | null>>
  show: (message: string, lead?: string) => void
  dismiss: () => void
} {
  const toast = useState<Toast | null>('toast', () => null)

  function dismiss(): void {
    window.clearTimeout(dismissTimer)
    toast.value = null
  }

  function show(message: string, lead?: string): void {
    if (!import.meta.client) return
    window.clearTimeout(dismissTimer)
    toast.value = { message, lead: lead ?? null }
    dismissTimer = window.setTimeout(dismiss, TOAST_MILLISECONDS)
  }

  return { toast: readonly(toast), show, dismiss }
}
