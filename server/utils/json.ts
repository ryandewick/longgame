/** A JSON object: string keys, values not yet checked. */
export type JsonRecord = Record<string, unknown>

/** Whether a value is a plain JSON object (not null, not an array). */
export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses request text as a JSON object. Returns undefined for anything else, including text that is not JSON. */
export function parseJsonRecord(text: string | undefined): JsonRecord | undefined {
  if (text === undefined) return undefined
  try {
    const parsed: unknown = JSON.parse(text)
    return isJsonRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
