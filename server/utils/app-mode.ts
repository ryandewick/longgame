/** The two ways the app runs: the public website, or a copy on the player's own machine that saves to disk. */
export type AppMode = 'hosted' | 'local'

/**
 * Reads the mode from configuration. Anything that is not exactly 'local' means hosted, so a typo in an environment
 * variable can never switch on the routes that write to disk.
 */
export function parseAppMode(configured: unknown): AppMode {
  return configured === 'local' ? 'local' : 'hosted'
}
