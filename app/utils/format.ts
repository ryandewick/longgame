import { formatHours } from '#shared/domain/format'

/** A length of time for a sentence rather than a column: '1,956 hours' where a table says '1,956 h'. */
export function formatLongHours(hours: number): string {
  return formatHours(hours).replace(/ h$/, ' hours')
}
