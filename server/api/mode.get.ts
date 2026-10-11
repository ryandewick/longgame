import { appMode } from '../utils/runtime'

/** GET /api/mode: tells the app whether it is the public website or a local copy. */
export default defineEventHandler((event) => ({ mode: appMode(event) }))
