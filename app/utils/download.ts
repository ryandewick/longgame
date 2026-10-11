/**
 * A download reads its object URL a moment after the click that started it, so a URL is only
 * released this long afterwards.
 */
export const DOWNLOAD_GRACE_MILLISECONDS = 2000

/** Hands the browser a file to save under this name. Browser only. */
export function downloadFile(contents: Blob, fileName: string): void {
  const url = URL.createObjectURL(contents)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  // some browsers only follow a link that is on the page
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_GRACE_MILLISECONDS)
}
