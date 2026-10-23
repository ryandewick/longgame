import { formatHours, formatNumber } from '#shared/domain/format'

/** A length of time for a sentence rather than a column: '1,956 hours' where a table says '1,956 h'. */
export function formatLongHours(hours: number): string {
  return formatHours(hours).replace(/ h$/, ' hours')
}

/**
 * How long a quest, a tier or a goal takes, as a readout: '15 min', '1 h 36 min', '6 h', and the
 * hour alone from ten hours up: '23 h'.
 */
export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes))
  if (whole < 60) return `${whole} min`
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  if (hours >= 10) return `${formatNumber(Math.round(whole / 60))} h`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
