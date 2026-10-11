/** The picture of the rack that the share dialog is showing. */
export interface RackShare {
  /** An object URL for the picture, for as long as the dialog is open. */
  readonly url: string
  /** What the picture is called when it is downloaded or shared: 'longgame-Zezima.png'. */
  readonly fileName: string
  /** What the picture shows, for someone who cannot see it. */
  readonly description: string
  /** This browser can put a picture on the clipboard. */
  readonly canCopy: boolean
  /** This device can hand the picture to another app (its share sheet takes files). */
  readonly canSend: boolean
}

// The picture itself, for Copy and Share. Like the answer in useConfirm it cannot live in
// `useState`, which holds only what can be serialised into the page; only the browser sets it.
let picture: File | undefined
// One picture is drawn at a time: a second press while the first is still drawing is ignored.
// The button that asks is not disabled meanwhile, because a disabled button loses the focus the
// dialog hands back when it closes.
let isDrawing = false

/**
 * "Share my rack": draws the account's rack as a picture and opens the dialog that offers it.
 * `open` does the drawing and `share` then holds what `ShareRackDialog` (in the default layout)
 * shows; `copy` and `send` are the dialog's two buttons that need the picture itself.
 */
export function useShareRack(): {
  share: Readonly<Ref<RackShare | null>>
  open: () => Promise<void>
  close: () => void
  /**
   * Puts the picture on the clipboard. Resolves with what to tell the player, which the dialog
   * says itself: a toast would sit behind an open dialog, out of sight and unannounced.
   */
  copy: () => Promise<string>
  /** Hands the picture to the device's share sheet. */
  send: () => Promise<void>
} {
  const share = useState<RackShare | null>('rack-share', () => null)
  const account = useAccountStore()
  const toast = useToast()
  const { siteUrl } = useRuntimeConfig().public

  async function draw(): Promise<File | null> {
    const canvas = await drawRackPicture(
      rackPictureLayout({
        name: account.name,
        isIronman: account.isIronman,
        totalLevel: account.hiscores?.totalLevel ?? 0,
        skills: account.account.skills,
        rackOrder: account.rackOrder,
        maxProgress: account.maxProgress,
        siteUrl,
      }),
    )
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    return blob && new File([blob], accountFileName(account.name, 'png'), { type: blob.type })
  }

  function close(): void {
    const closing = share.value
    if (!closing) return
    share.value = null
    picture = undefined
    // a download started just before the dialog closed still needs the picture for a moment
    window.setTimeout(() => URL.revokeObjectURL(closing.url), DOWNLOAD_GRACE_MILLISECONDS)
  }

  async function open(): Promise<void> {
    if (!import.meta.client || isDrawing || !account.hasAccount) return
    isDrawing = true
    let drawn: File | null = null
    try {
      drawn = await draw()
    } catch (error) {
      // a cape render that would not load, or a browser without a canvas
      console.warn('Could not draw the rack.', error)
    } finally {
      isDrawing = false
    }
    if (!drawn) {
      toast.show('Could not draw the picture here.')
      return
    }
    close()
    picture = drawn
    share.value = {
      url: URL.createObjectURL(drawn),
      fileName: drawn.name,
      description: rackPictureDescription(account.name, account.maxProgress),
      canCopy: 'clipboard' in navigator && 'ClipboardItem' in window,
      canSend: navigator.canShare?.({ files: [drawn] }) ?? false,
    }
  }

  async function copy(): Promise<string> {
    const couldNot = 'Could not copy it. Download it instead.'
    if (!picture) return couldNot
    try {
      await navigator.clipboard.write([new ClipboardItem({ [picture.type]: picture })])
      return 'Copied. Paste it wherever you like.'
    } catch {
      // the browser refused: the page is not focused, or the player said no to the clipboard
      return couldNot
    }
  }

  async function send(): Promise<void> {
    if (!picture) return
    try {
      await navigator.share({ files: [picture], title: 'My Long Game rack' })
    } catch {
      // the player closed the share sheet, which is an answer and not a fault
    }
  }

  return { share: readonly(share), open, close, copy, send }
}
