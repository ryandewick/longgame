/**
 * The outcome of a step that can be refused: either a value, or the reason it was refused.
 *
 * The rules in this folder (validation, the Jagex lookup) return a `Result` instead of throwing, so they stay plain
 * functions that can be tested without a server. A route turns a failure into an HTTP error with `valueOrThrow`
 * (see errors.ts).
 */
export type Result<Value> = Success<Value> | Refusal

export interface Success<Value> {
  ok: true
  value: Value
}

export interface Refusal {
  ok: false
  failure: Failure
}

/** Why a request was refused: the HTTP status to answer with and a sentence the player can be shown. */
export interface Failure {
  statusCode: number
  message: string
}

/** Wraps a value as a successful result. */
export function success<Value>(value: Value): Success<Value> {
  return { ok: true, value }
}

/** Builds a refused result from an HTTP status and a message for the player. */
export function failure(statusCode: number, message: string): Refusal {
  return { ok: false, failure: { statusCode, message } }
}
