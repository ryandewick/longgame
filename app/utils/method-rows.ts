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

/** The wiki's page on tick manipulation: the Tick-perfect tag and the Settings help link to it. */
export const TICK_MANIPULATION_PAGE = 'https://oldschool.runescape.wiki/w/Tick_manipulation'

/**
 * What the Tick-perfect tag says when pointed at: what the method needs, and where the link goes.
 * The planner also says when the player's setting leaves the method out of plans; a guide, with
 * no account behind it, leaves `tickMethodsOn` out.
 */
export function tickPerfectTagTitle(tickMethodsOn?: boolean): string {
  const needs =
    'Needs tick manipulation: acting on exact game ticks so the skill rolls more often. Its rate assumes you have practised it.'
  const leftOut =
    tickMethodsOn === false
      ? ' Plans and estimates leave it out until you turn on tick-perfect methods in Settings.'
      : ''
  return `${needs}${leftOut} Opens the wiki’s page on tick manipulation.`
}

/**
 * Is the method left out of plans by the player's own setting? A tick-perfect method is while
 * tick-perfect methods are off: the table dims it and says so, as it does a method the account
 * cannot use yet. False where the setting is not known.
 */
export function isOffBySetting(option: MethodOption, tickMethodsOn?: boolean): boolean {
  return option.method.tickPerfect && tickMethodsOn === false
}

/**
 * What a method takes to keep going. A main pays for it, so it is a cost; an ironman cannot buy
 * anything, so what matters is whether the supplies are their own to gather.
 */
export function methodSuppliesText(method: Method, isIronman: boolean): string {
  if (!isIronman) return COST_LABELS[method.cost]
  return method.usesOwnSupplies ? 'your own' : 'none'
}
