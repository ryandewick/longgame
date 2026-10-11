/** The two ways the app runs: the public website, or a copy on the player's own machine that saves to disk. */
export type AppMode = 'hosted' | 'local'

/**
 * Which way this copy is running, from `runtimeConfig.public.mode`. Anything that is not exactly
 * 'local' is the website, which is the same reading the server makes of it.
 */
export function useAppMode(): AppMode {
  return useRuntimeConfig().public.mode === 'local' ? 'local' : 'hosted'
}
