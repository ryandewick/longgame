import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appBrowserCandidates,
  appProfileDirectory,
  appWindowArguments,
  NEEDS_PREPARING_EXIT_CODE,
  parseLaunchMode,
} from '~~/tools/local-copy/app-window'

describe('parseLaunchMode', () => {
  it('runs the console way with no arguments, as before there were any', () => {
    expect(parseLaunchMode([])).toBe('console')
    expect(parseLaunchMode(['--something-else'])).toBe('console')
  })

  it('reads the check, the prepare step and the app window', () => {
    expect(parseLaunchMode(['--check'])).toBe('check')
    expect(parseLaunchMode(['--prepare'])).toBe('prepare')
    expect(parseLaunchMode(['--app-window'])).toBe('app-window')
  })

  it('says by a code of its own that an install or a build comes first, apart from success and failure', () => {
    expect(NEEDS_PREPARING_EXIT_CODE).not.toBe(0)
    expect(NEEDS_PREPARING_EXIT_CODE).not.toBe(1)
  })
})

describe('appBrowserCandidates', () => {
  const folders = {
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\player\\AppData\\Local',
  }

  it('tries Chrome wherever it installs, then Edge', () => {
    expect(appBrowserCandidates(folders)).toEqual([
      {
        name: 'chrome',
        path: join('C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      },
      {
        name: 'chrome',
        path: join('C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      },
      {
        name: 'chrome',
        path: join(
          'C:\\Users\\player\\AppData\\Local',
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        ),
      },
      {
        name: 'edge',
        path: join('C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      },
      {
        name: 'edge',
        path: join('C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      },
    ])
  })

  it('leaves out a folder the environment does not name', () => {
    expect(appBrowserCandidates({ ProgramFiles: '', LOCALAPPDATA: undefined })).toEqual([])
    expect(
      appBrowserCandidates({ 'ProgramFiles(x86)': 'C:\\x86' }).map((browser) => browser.name),
    ).toEqual(['chrome', 'edge'])
  })
})

describe('appProfileDirectory', () => {
  it("keeps a profile per browser in the player's application data", () => {
    expect(appProfileDirectory('chrome', 'C:\\Data')).toBe(
      join('C:\\Data', 'Long Game', 'app-window-chrome'),
    )
    expect(appProfileDirectory('edge', 'C:\\Data')).toBe(
      join('C:\\Data', 'Long Game', 'app-window-edge'),
    )
  })
})

describe('appWindowArguments', () => {
  it('opens the address as an app, from its own profile, with no first-run screens', () => {
    expect(appWindowArguments('http://localhost:8765/', 'C:\\Data\\profile')).toEqual([
      '--app=http://localhost:8765/',
      '--user-data-dir=C:\\Data\\profile',
      '--no-first-run',
      '--no-default-browser-check',
    ])
  })
})
