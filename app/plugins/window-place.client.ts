import { readWindowPlace, type WindowPlace } from '#shared/domain/window-place'

/** How often the window's place is looked at: a window being moved fires no event. */
const LOOK_EVERY_MILLISECONDS = 2000

/**
 * In the desktop app (a local copy in an app window: see tools/local-copy), keeps the local server told where the
 * window is and how big, so that the launcher opens the next window the same. Chrome does not remember that for an
 * app window itself. An ordinary browser tab, and the website, report nothing.
 */
export default defineNuxtPlugin(() => {
  if (useAppMode() !== 'local' || !window.matchMedia('(display-mode: standalone)').matches) return

  /** The place last sent, so the same one is not sent again. */
  let sent = ''

  // A minimised window reports a place far off the screen, which reads as no place and is not sent.
  const placeNow = (): WindowPlace | null =>
    readWindowPlace({
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
    })

  function report(windowIsClosing: boolean): void {
    const place = placeNow()
    const body = place && JSON.stringify(place)
    if (!body || body === sent) return
    sent = body
    // as the window closes, only a beacon is sure to leave before the page does
    if (windowIsClosing) navigator.sendBeacon('/api/window-place', body)
    else
      $fetch('/api/window-place', { method: 'POST', body: place }).catch(() => {
        sent = ''
      })
  }

  window.setInterval(() => report(false), LOOK_EVERY_MILLISECONDS)
  window.addEventListener('pagehide', () => report(true))
})
