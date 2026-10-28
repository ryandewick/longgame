import { join } from 'node:path'

/*
 * The launcher's choices for showing Long Game in a window of its own, as plain functions: which way it was asked to
 * run, which browsers can open an app window, what such a window is told, and where it keeps its profile. They read
 * no files; the launcher hands in what they need.
 */

/**
 * How the launcher was asked to run:
 * - console: what Long Game.bat does by default, installing and building as needed, then the server in that
 *   window and the player's usual browser;
 * - check: only say, by the exit code, whether an install or a build is needed first;
 * - prepare: install and build as needed, and start nothing (Long Game.bat's "prepare");
 * - app-window: start the server with no window of its own and show Long Game in an app window, stopping the
 *   server when that window closes (what the desktop shortcut runs, through open-app.ps1).
 */
export type LaunchMode = 'console' | 'check' | 'prepare' | 'app-window'

/** What `--check` exits with when an install or a build has to happen before Long Game can start. */
export const NEEDS_PREPARING_EXIT_CODE = 3

/** Reads the launcher's arguments. Anything it does not know is the console way, as before there were any. */
export function parseLaunchMode(args: readonly string[]): LaunchMode {
  if (args.includes('--check')) return 'check'
  if (args.includes('--prepare')) return 'prepare'
  if (args.includes('--app-window')) return 'app-window'
  return 'console'
}

/** A browser that can show a page as an app window, and the short name its profile folder is kept under. */
export interface AppBrowser {
  readonly path: string
  readonly name: 'chrome' | 'edge'
}

/** The environment variables the browsers' install folders are found from. */
export type InstallFolders = Readonly<Record<string, string | undefined>>

const isSet = (folder: string | undefined): folder is string =>
  folder !== undefined && folder !== ''

/**
 * Where Chrome and Edge install on Windows, in the order to try them: Chrome first, for every user or for this one,
 * then Edge, which comes with Windows.
 */
export function appBrowserCandidates(folders: InstallFolders): AppBrowser[] {
  const chrome = [folders.ProgramFiles, folders['ProgramFiles(x86)'], folders.LOCALAPPDATA]
    .filter(isSet)
    .map((base): AppBrowser => ({
      path: join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      name: 'chrome',
    }))
  const edge = [folders['ProgramFiles(x86)'], folders.ProgramFiles]
    .filter(isSet)
    .map((base): AppBrowser => ({
      path: join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      name: 'edge',
    }))
  return [...chrome, ...edge]
}

/**
 * The browser profile the app window keeps, one per browser (two browsers cannot share one), in the player's own
 * application data rather than the project. A profile of its own is what makes it a window apart: its own taskbar
 * entry, its size remembered, and a process that ends when the window closes, which is how the launcher knows to
 * stop the server.
 */
export function appProfileDirectory(browser: AppBrowser['name'], applicationData: string): string {
  return join(applicationData, 'Long Game', `app-window-${browser}`)
}

/** What the browser is told: show this address as an app (no tabs, no address bar), from the app's own profile. */
export function appWindowArguments(address: string, profileDirectory: string): string[] {
  return [
    `--app=${address}`,
    `--user-data-dir=${profileDirectory}`,
    '--no-first-run',
    '--no-default-browser-check',
  ]
}
