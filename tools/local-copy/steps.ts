import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { pathToFileURL } from 'node:url'
import {
  isBuildStale,
  isInstallStale,
  parseBuildStamp,
  parsePort,
  type BuildStamp,
} from './freshness.ts'
import {
  INSTALL_RECORD,
  LOCAL_ADD_ON_CONFIG,
  LOCAL_BUILD_SOURCES,
  LOCAL_BUILD_STAMP,
  LOCAL_SERVER_ENTRY,
  LOCKFILE,
  PROJECT_ROOT,
} from './paths.ts'
import { modifiedTime, newestModifiedTime, projectPath, readText } from './project-files.ts'

/*
 * What running a local copy takes, one step per function: install, build, start. The three commands in this folder
 * (build.ts, start.ts, launch.ts) only choose which steps to run.
 */

/**
 * A failure the player can do something about. Its message is a full sentence and is all that gets printed; any
 * other error is a fault in the launcher and is printed whole.
 */
export class ReadableError extends Error {}

/** Only this machine can reach the server: it reads and writes the player's saves without asking who is calling. */
const LOOPBACK_ADDRESS = '127.0.0.1'

/** How long a freshly started server gets to answer its first request. */
const START_TIMEOUT_MILLISECONDS = 30_000

function hasAddOn(): boolean {
  return existsSync(projectPath(LOCAL_ADD_ON_CONFIG))
}

/** The port to serve on, from LONGGAME_PORT. */
function configuredPort(): number {
  const port = parsePort(process.env.LONGGAME_PORT)
  if (port === null) {
    throw new ReadableError(
      `LONGGAME_PORT is set to "${process.env.LONGGAME_PORT}", which is not a port number. Unset it to use the usual port.`,
    )
  }
  return port
}

/** Runs `npm install`, so node_modules matches package-lock.json. */
export function installDependencies(): void {
  // npm is a .cmd file on Windows, which Node only runs through a shell
  const outcome = spawnSync('npm install --no-audit --no-fund', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true,
  })
  if (outcome.status !== 0) {
    throw new ReadableError(
      'Could not install what Long Game needs. The lines above say why; the usual cause is no internet connection.',
    )
  }
}

/** Builds the app as a local copy: a Node server in .output-local that keeps saves on disk. */
export function buildLocalCopy(): void {
  const stamp: BuildStamp = { startedAt: Date.now(), hasAddOn: hasAddOn() }
  // without its stamp, a build that stops half way is never mistaken for a finished one
  rmSync(projectPath(LOCAL_BUILD_STAMP), { force: true })

  const outcome = spawnSync(
    process.execPath,
    [projectPath('node_modules/nuxt/bin/nuxt.mjs'), 'build', '--preset', 'node-server'],
    {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      // nuxt.config.ts reads this: local mode, no pages written out, the build's own folders, the add-on if present
      env: { ...process.env, NUXT_PUBLIC_MODE: 'local' },
    },
  )
  if (outcome.status !== 0) {
    throw new ReadableError('The build did not finish. The lines above say why.')
  }
  writeFileSync(projectPath(LOCAL_BUILD_STAMP), JSON.stringify(stamp))
}

/** Whether nothing is listening on the port yet. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, LOOPBACK_ADDRESS, () => probe.close(() => resolve(true)))
  })
}

/** Whether a local copy of Long Game answers on the port. */
async function isLongGameAnswering(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${LOOPBACK_ADDRESS}:${port}/api/mode`, {
      signal: AbortSignal.timeout(2000),
    })
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null && 'mode' in body && body.mode === 'local'
  } catch {
    return false
  }
}

async function waitUntilAnswering(port: number): Promise<void> {
  const giveUpAt = Date.now() + START_TIMEOUT_MILLISECONDS
  while (Date.now() < giveUpAt) {
    if (await isLongGameAnswering(port)) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new ReadableError(
    'The server started but is not answering. Close this window and try again.',
  )
}

/** Opens an address in the player's usual browser. */
function openInBrowser(address: string): void {
  // `start` belongs to cmd, and its first quoted argument is a window title, hence the empty one
  const opener =
    process.platform === 'win32'
      ? { command: 'cmd', parameters: ['/c', 'start', '', address] }
      : { command: process.platform === 'darwin' ? 'open' : 'xdg-open', parameters: [address] }
  const browser = spawn(opener.command, opener.parameters, { stdio: 'ignore', detached: true })
  // having no browser to open is not a reason to stop: the address has been printed
  browser.on('error', () => {})
  browser.unref()
}

/**
 * Starts the built server and keeps this process running as that server. When a local copy is already running on
 * the port, that one is used and this returns straight away.
 */
export async function startLocalCopy(options: { openBrowser: boolean }): Promise<void> {
  const port = configuredPort()
  const address = `http://localhost:${port}/`

  if (!(await isPortFree(port))) {
    if (!(await isLongGameAnswering(port))) {
      throw new ReadableError(
        `Port ${port} is being used by another program. Close that program, or set LONGGAME_PORT to another port.`,
      )
    }
    console.log(`Long Game is already running at ${address}`)
    if (options.openBrowser) openInBrowser(address)
    return
  }
  if (!existsSync(projectPath(LOCAL_SERVER_ENTRY))) {
    throw new ReadableError('There is no local build yet. Run "npm run build:local" first.')
  }

  // The server keeps saves in ./.data and looks for the old app's saves in ./data, both from the folder it runs in.
  // Making that folder the top of the project puts them in one fixed place wherever this was started from.
  process.chdir(PROJECT_ROOT)
  process.env.NITRO_HOST = LOOPBACK_ADDRESS
  process.env.NITRO_PORT = String(port)
  // importing the server's entry file starts it listening
  await import(pathToFileURL(projectPath(LOCAL_SERVER_ENTRY)).href)
  await waitUntilAnswering(port)

  console.log('')
  console.log(`Long Game is running at ${address}`)
  console.log(`Your saves are in ${projectPath('.data')}`)
  console.log('Leave this window open while you play. Close it to stop.')
  if (options.openBrowser) openInBrowser(address)
}

/**
 * Everything the launcher does: installs on a first run or after package-lock.json changes, builds on a first run
 * or after the sources change, then starts the server and opens the browser.
 */
export async function launchLocalCopy(): Promise<void> {
  if (isInstallStale(modifiedTime(INSTALL_RECORD), modifiedTime(LOCKFILE))) {
    console.log('Installing what Long Game needs. The first time takes a few minutes.')
    installDependencies()
  }
  const stamp = parseBuildStamp(readText(LOCAL_BUILD_STAMP))
  if (isBuildStale(stamp, newestModifiedTime(LOCAL_BUILD_SOURCES), hasAddOn())) {
    console.log('Building Long Game. This takes a minute.')
    buildLocalCopy()
  }
  await startLocalCopy({ openBrowser: true })
}

/** Runs one of the commands. When it cannot finish, the process ends with a message and a failing exit code. */
export async function runCommand(command: () => void | Promise<void>): Promise<void> {
  try {
    await command()
  } catch (error) {
    console.error('')
    console.error(error instanceof ReadableError ? error.message : error)
    process.exit(1)
  }
}
