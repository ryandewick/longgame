import { fileURLToPath } from 'node:url'

/*
 * Where a local copy's files are. Folders are named from the top of the project. nuxt.config.ts reads the two build
 * folders from here, so the build and the launcher cannot disagree about them.
 */

/** The top of the project, worked out from where this file is, so it does not matter where a command is run from. */
export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Nuxt's working folder for a local build. The website's build and `nuxt dev` use .nuxt. */
export const LOCAL_BUILD_DIRECTORY = '.nuxt-local'

/** Where a local build puts the finished server. The website's build uses .output. */
export const LOCAL_OUTPUT_DIRECTORY = '.output-local'

/** The file Node runs to start a local copy's server. */
export const LOCAL_SERVER_ENTRY = `${LOCAL_OUTPUT_DIRECTORY}/server/index.mjs`

/** What tools/local-copy/build.ts writes when a build has finished (see BuildStamp in freshness.ts). */
export const LOCAL_BUILD_STAMP = `${LOCAL_OUTPUT_DIRECTORY}/build-stamp.json`

/** The private add-on's own configuration. A local build takes the add-on in when this file is there. */
export const LOCAL_ADD_ON_CONFIG = 'local/nuxt.config.ts'

/** What a local build is made from. A change to any of these means the build is out of date. */
export const LOCAL_BUILD_SOURCES: readonly string[] = [
  'app',
  'server',
  'shared',
  'datasrc',
  'public',
  'local',
  'tools/local-copy',
  'nuxt.config.ts',
  'package.json',
  'package-lock.json',
]

/** npm's own record of what is in node_modules, rewritten at the end of every install. */
export const INSTALL_RECORD = 'node_modules/.package-lock.json'
export const LOCKFILE = 'package-lock.json'
