/**
 * Has the save been loaded into the stores? False on the server and while the page hydrates,
 * true from then on (plugins/persistence.client.ts sets it, whether or not a save was found).
 *
 * Pages are prerendered without any account, so anything drawn from the stores must wait for
 * this, or the browser's first render would not match the HTML it was sent.
 */
export function useSaveReady(): Ref<boolean> {
  return useState('save-ready', () => false)
}
