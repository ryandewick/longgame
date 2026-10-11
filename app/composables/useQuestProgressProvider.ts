/**
 * Does this copy have an add-on that reports the account's quests and diaries, by answering
 * /api/quest-progress?
 *
 * Only a local copy can have one, and only when the add-on has switched `questProgressProvider`
 * on in the runtime configuration. The website never has: there every quest and diary is ticked
 * by hand.
 */
export function useQuestProgressProvider(): boolean {
  return useAppMode() === 'local' && useRuntimeConfig().public.questProgressProvider === true
}
