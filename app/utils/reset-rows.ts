import type { Account } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { RESETS } from '#shared/data/resets'
import { formatWait } from '#shared/domain/format'
import { describeMissingRequirement, missingRequirements } from '#shared/domain/requirements'
import {
  describeLastDone,
  describeResetCadence,
  resetAppliesTo,
  resetCadence,
  resetStatus,
  type ResetLog,
} from '#shared/domain/resets'

/** One reset as the Resets page lists it. */
export interface ResetsTableRow {
  readonly key: string
  readonly name: string
  readonly note: string
  /** The skill it trains, whose icon leads the row. Null when it trains none. */
  readonly skill: SkillKey | null
  /** What the account still lacks for it: 'Bone Voyage, 23 Farming'. Null when it is unlocked. */
  readonly needs: string | null
  /** How often it comes round for this account: '80 min', 'Daily, 00:00 UTC'. */
  readonly every: string
  readonly isDue: boolean
  /** Beside "Due", when it was last done ('last 3 h ago'); otherwise the wait ('ready in 2 h'). */
  readonly status: string
}

/**
 * Every reset open to the account's type, in the data's order, locked ones included: a locked
 * reset says what it needs, so the player can see what a quest or a level would bring.
 *
 * `now` is the screen's idea of the time, which only moves every so often. A reset logged since
 * it last moved is read as done this instant, not as done in the future.
 */
export function resetsTableRows(account: Account, log: ResetLog, now: number): ResetsTableRow[] {
  return RESETS.filter((reset) => resetAppliesTo(reset, account)).map((reset) => {
    const missing = missingRequirements(account, reset.requirements)
    const lastDoneAt = log[reset.key]
    const status = resetStatus(account, reset, lastDoneAt, Math.max(now, lastDoneAt ?? 0))
    return {
      key: reset.key,
      name: reset.name,
      note: reset.note,
      skill: reset.skill,
      needs: missing.length ? missing.map(describeMissingRequirement).join(', ') : null,
      every: describeResetCadence(resetCadence(account, reset)),
      isDue: status.due,
      status: status.due
        ? describeLastDone(status.lastDoneAt, now)
        : `ready in ${formatWait(status.readyInMilliseconds)}`,
    }
  })
}
