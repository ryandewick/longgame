import type { AccountType } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { accountCapes } from '#shared/domain/capes'
import { formatNumber, formatTimeAgo } from '#shared/domain/format'
import type { SavedHiscores, SavedState } from '#shared/domain/save'
import { MAX_LEVEL } from '#shared/domain/xp'

/*
 * What the account in the top bar and its menu of accounts say.
 */

/** A cape an account is known by: its skill, and whether it is the trimmed cape a 99 wears. */
export interface AccountCape {
  readonly skill: SkillKey
  readonly trimmed: boolean
}

/** One saved account in the menu. */
export interface AccountRow {
  readonly name: string
  /** 'Ironman' or 'Main'. Until the lookup has said, an account is planned as a main. */
  readonly kind: string
  /** Its total level as the game writes it ('1,647'); empty before its stats have ever loaded. */
  readonly totalLevel: string
  /** Its three highest skills' capes, the highest last, so it hangs on top of the fan. */
  readonly capes: readonly AccountCape[]
  readonly isOpen: boolean
  /** The whole row in words, for a screen reader: 'kodify, Ironman, total level 1,647, open now'. */
  readonly label: string
}

/** The account's kind as the menu and the top bar name it. */
const kindOf = (accountType: AccountType | null): string =>
  accountType === 'iron' ? 'Ironman' : 'Main'

function capesOf(hiscores: SavedHiscores | null): AccountCape[] {
  if (!hiscores) return []
  return accountCapes(hiscores.skills).map((skill) => ({
    skill,
    trimmed: hiscores.skills[skill].level >= MAX_LEVEL,
  }))
}

/** Every saved account as the menu lists it, in the order they were added. */
export function accountRows(
  accounts: readonly SavedState[],
  openIndex: number | null,
): AccountRow[] {
  return accounts.map((save, place) => {
    const kind = kindOf(save.accountType)
    const totalLevel = save.hiscores ? formatNumber(save.hiscores.totalLevel) : ''
    const isOpen = place === openIndex
    const label = [
      save.name,
      kind,
      totalLevel ? `total level ${totalLevel}` : '',
      isOpen ? 'open now' : '',
    ]
      .filter(Boolean)
      .join(', ')
    return { name: save.name, kind, totalLevel, capes: capesOf(save.hiscores), isOpen, label }
  })
}

/** The line under the open account's name: 'Ironman, stats 5 min ago', or 'stats just now' for a main. */
export function accountStatus(
  accountType: AccountType | null,
  hiscores: SavedHiscores | null,
  now: number,
): string {
  if (!hiscores) return ''
  const fetched = `stats ${formatTimeAgo(hiscores.fetchedAt, now)}`
  return accountType === 'iron' ? `Ironman, ${fetched}` : fetched
}

/**
 * What the account button says to a screen reader: what it shows, then what it opens, so the
 * words on screen lead its name: 'kodify, Ironman, stats 5 min ago. Your accounts'.
 */
export function accountButtonLabel(name: string, status: string): string {
  return `${[name, status].filter(Boolean).join(', ')}. Your accounts`
}
