import type { Reset } from '../types/reset'
import resets from '../../datasrc/resets.json'
import { buildResets } from './build-resets'

/** Every timed run, daily and weekly, in the order the Resets page lists them. */
export const RESETS: readonly Reset[] = buildResets(resets)
