import type { Method } from '#shared/types/method'
import { COST_LABELS, formatShortNumber } from '#shared/domain/format'
import type { MethodOption } from '#shared/domain/methods'
import { describeMissingRequirement } from '#shared/domain/requirements'

/**
 * A method's rate as the method table writes it: XP a run for a timed run, XP an hour otherwise
 * ('est.' when it is worked out from the account's levels rather than given by the wiki), and
 * 'no rate' when the wiki gives none.
 */
export function methodRateText(option: MethodOption): string {
  if (option.method.timedRun && option.xpPerRun) {
    return `≈ ${formatShortNumber(option.xpPerRun)} a run`
  }
  if (!option.xpPerHour) return 'no rate'
  const prefix = option.method.computedRate ? 'est. ' : '≈ '
  return `${prefix}${formatShortNumber(option.xpPerHour)}/h`
}

/** 'Needs Monkey Madness II, the Grand Exchange.' Empty when the account lacks nothing but the level. */
export function methodNeedsText(option: MethodOption): string {
  if (!option.missing.length) return ''
  return `Needs ${option.missing.map(describeMissingRequirement).join(', ')}.`
}

/**
 * What a method takes to keep going. A main pays for it, so it is a cost; an ironman cannot buy
 * anything, so what matters is whether the supplies are their own to gather.
 */
export function methodSuppliesText(method: Method, isIronman: boolean): string {
  if (!isIronman) return COST_LABELS[method.cost]
  return method.usesOwnSupplies ? 'your own' : 'none'
}
