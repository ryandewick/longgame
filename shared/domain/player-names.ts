/*
 * RuneScape display names, and when two of them are the same account's.
 */

/**
 * A name as a key: lower case, with every run of characters other than letters and digits as one
 * underscore. Case does not count in a RuneScape name and the game treats a space and an
 * underscore alike, so 'Lynx Titan' and 'lynx_titan' have one key. It is the key the browser has
 * always kept each player's XP history under.
 */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

/** Are these two names the same account's? Two saved accounts never share a name in this sense. */
export function isSameName(first: string, second: string): boolean {
  return nameKey(first) === nameKey(second)
}
