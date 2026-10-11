import type { SkillKey } from '#shared/types/skill'

/** What to say when a suggestion fails and the server gave no reason of its own. */
const SEND_FAILED_MESSAGE = 'Could not send it.'

/**
 * The "Suggest a method" form: a visitor to the website sends a method the lists are missing,
 * which the server files for checking against the wiki. `open(skill)` shows the form with that
 * skill picked, and `open()` with none picked, for a list that spans skills. `SuggestMethodDialog`
 * (in both layouts) draws it and calls `send`.
 */
export function useSuggestMethod(): {
  isOpen: Readonly<Ref<boolean>>
  /** The skill the form opened on; null when it opened with none picked, and while it is closed. */
  skill: Readonly<Ref<SkillKey | null>>
  open: (skill?: SkillKey | null) => void
  close: () => void
  /** Sends a suggestion. Resolves with what to tell the player when it fails, or null when it is sent. */
  send: (draft: SuggestionDraft) => Promise<string | null>
} {
  const isOpen = useState('suggest-method-open', () => false)
  const skill = useState<SkillKey | null>('suggest-method-skill', () => null)

  function open(forSkill: SkillKey | null = null): void {
    if (!import.meta.client) return
    skill.value = forSkill
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    skill.value = null
  }

  async function send(draft: SuggestionDraft): Promise<string | null> {
    try {
      await $fetch('/api/suggestions', { method: 'POST', body: draft })
      return null
    } catch (error) {
      return apiErrorMessage(error) ?? SEND_FAILED_MESSAGE
    }
  }

  return { isOpen: readonly(isOpen), skill: readonly(skill), open, close, send }
}
