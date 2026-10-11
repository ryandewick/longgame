import type { Method } from '../types/method'
import type { SkillKey } from '../types/skill'
import { METHODS } from '../data/methods'
import { INTENSITY_LABELS } from './format'
import {
  AFK_GUIDE_PATH,
  GUIDES_PATH,
  GUIDE_SKILLS,
  buildSkillGuides,
  guideMethodCount,
  guidePath,
  type GuideMethod,
} from './guides'

/*
 * What the website says about itself, and the files it publishes for search engines and AI
 * assistants: the sitemap, robots.txt, llms.txt, llms-full.txt and the method data. All of it is
 * text built from the method data by pure functions; the server routes only add a content type.
 */

export const SITE_NAME = 'Long Game'

/** The home page's title and description, as a search result shows them. */
export const HOME_TITLE = 'Long Game: OSRS maxing planner and skill training tracker'
export const HOME_DESCRIPTION =
  'Free Old School RuneScape maxing planner. Enter your name to see all 24 skillcapes, the hours left to max, and a training session built for your account.'

/** The link preview image (public/og.png) and its size. */
export const PREVIEW_IMAGE = { path: '/og.png', width: 1200, height: 630 } as const

export const WIKI_URL = 'https://oldschool.runescape.wiki/'
export const DATA_LICENCE = {
  name: 'CC BY-NC-SA 3.0',
  url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
} as const

export const METHODS_JSON_PATH = '/data/methods.json'
export const LLMS_FULL_PATH = '/llms-full.txt'

export interface Question {
  readonly question: string
  readonly answer: string
}

/** The questions a new visitor asks. The landing page, its structured data and llms.txt all read this list. */
export const QUESTIONS: readonly Question[] = [
  {
    question: 'Is Long Game free?',
    answer: 'Yes. It is a free fan project with no adverts, no account and nothing to pay for.',
  },
  {
    question: 'Do I need to log in or give a password?',
    answer:
      'No. You only type your display name. Long Game looks it up on the official Old School RuneScape hiscores, which are public. It never asks for a password and cannot touch your account.',
  },
  {
    question: 'Does it work for ironmen?',
    answer:
      'Yes. It tells a main from an ironman from the hiscores and plans with the ironman routes from the wiki, leaving out every method that needs the Grand Exchange.',
  },
  {
    question: 'How does it know how long maxing will take?',
    answer:
      'For each skill it takes the XP you have left and the fastest method your levels, quests and diaries allow at each level, using the hourly rates on the Old School RuneScape Wiki. Where the wiki gives no rate it says the figure is rough.',
  },
  {
    question: 'How does it know which quests I have done?',
    answer:
      'It asks. The public hiscores list your levels but not your quests or diaries, and there is no public source for those, so Long Game asks a few yes or no questions about the ones that would change your plan. A full tick list is there too, with shortcuts if you have the quest cape or every diary.',
  },
  {
    question: 'Where do the training methods come from?',
    answer:
      'Every method and rate is adapted from the Old School RuneScape Wiki and credited to it. The data is published under the same licence, CC BY-NC-SA 3.0.',
  },
  {
    question: 'Is every training method listed?',
    answer:
      'No. Every method listed was checked against the Old School RuneScape Wiki, and there will be good ones missing. You can suggest a method from the Methods page or any guide page, and it is checked against the wiki before it is added. Rates are the wiki’s and assume its setups, so your own will vary.',
  },
  {
    question: 'Where is my data kept?',
    answer:
      'In your own browser. Your sessions, ticks and XP history are not sent anywhere. You can export them to a file from Settings.',
  },
  {
    question: 'Is this made by Jagex?',
    answer: 'No. Long Game is not endorsed by or affiliated with Jagex.',
  },
]

/** The site's address without a slash at the end, so a path can be put straight after it. */
export function normaliseSiteUrl(siteUrl: string): string {
  return siteUrl.trim().replace(/\/+$/, '')
}

/** A page's full address: 'https://longgame.tools/guides/mining/'. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return normaliseSiteUrl(siteUrl) + path
}

/** Every page a search engine should list: the planner, the guide index, the AFK page and each skill's guide. */
export function publicPagePaths(): string[] {
  return ['/', GUIDES_PATH, AFK_GUIDE_PATH, ...GUIDE_SKILLS.map(guidePath)]
}

/** The planner's own screens. A visitor with no account sees the setup screen on each of them. */
export const PLANNER_PATHS: readonly string[] = [
  '/',
  '/skills',
  '/methods',
  '/quests',
  '/resets',
  '/history',
  '/settings',
]

/** The files written for machines rather than people. */
export const SITE_FILE_PATHS: readonly string[] = [
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
  LLMS_FULL_PATH,
  METHODS_JSON_PATH,
]

/**
 * Every address the build writes out as a file: the planner's screens, every public page, the
 * 404 page and the files for machines. Named one by one, so nothing depends on a crawler
 * finding a link to it.
 */
export function prerenderedRoutes(): string[] {
  return [...new Set([...PLANNER_PATHS, ...publicPagePaths(), '/404.html', ...SITE_FILE_PATHS])]
}

/**
 * A guide's address without the slash at its end: '/guides' or '/guides/afk'. The build must not
 * write these out. `nuxt generate` offers its crawler every fixed page by its route path, which
 * has no slash, while the guides link to each other with one; both spellings are the same file,
 * and two renders writing one file at once fail the build on Windows.
 */
export const UNSLASHED_GUIDE_ROUTE = /^\/guides(\/[^/.]+)?$/

const escapeXml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** sitemap.xml: the address of every public page. */
export function buildSitemap(siteUrl: string): string {
  const entries = publicPagePaths().map(
    (path) => `<url><loc>${escapeXml(absoluteUrl(siteUrl, path))}</loc></url>\n`,
  )
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('') +
    '</urlset>\n'
  )
}

/** robots.txt: everything may be crawled except the API, whose answers are about one player at one moment. */
export function buildRobots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}\n`
}

/**
 * llms.txt: the site described for an AI assistant in the llmstxt.org layout. A summary, the
 * facts worth repeating, a link to every page and to the data, and the questions with their answers.
 */
export function buildLlmsSummary(siteUrl: string): string {
  const link = (label: string, path: string, note: string): string =>
    `- [${label}](${absoluteUrl(siteUrl, path)})${note && `: ${note}`}`
  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${HOME_DESCRIPTION}`,
    '',
    'Long Game is a free, browser-based planner for Old School RuneScape (OSRS) players working toward the max cape. A player types their display name; it reads their levels from the public hiscores, shows all 24 skillcapes filling toward level 99, estimates the hours left to max, and deals timed training sessions from methods that account has unlocked. It handles mains and ironmen separately.',
    '',
    '## Key facts',
    '',
    '- Free. No adverts, no login, no password. Only a display name is needed.',
    '- Player data stays in the player’s browser.',
    `- ${guideMethodCount()} training methods across ${GUIDE_SKILLS.length} skills, adapted from the Old School RuneScape Wiki under ${DATA_LICENCE.name}.`,
    '- The list of methods is not complete. Anyone can suggest one, and it is checked against the wiki before it is added.',
    '- Quests and diaries are not on the hiscores, so the planner asks about the few that would change a player’s plan. Which quests require which is adapted from the same wiki, under the same licence.',
    '- A fan project. Not endorsed by or affiliated with Jagex.',
    '',
    '## Pages',
    '',
    link('Planner', '/', 'the app'),
    link('Training guides', GUIDES_PATH, 'every method for every skill'),
    link('AFK methods', AFK_GUIDE_PATH, 'every AFK method across all skills'),
    ...buildSkillGuides().map((guide) =>
      link(
        `${guide.name} training`,
        guide.path,
        `${guide.methods.length} methods, level ${guide.methods[0]?.level ?? 1} to 99`,
      ),
    ),
    '',
    '## Data',
    '',
    link('All methods as JSON', METHODS_JSON_PATH, ''),
    link('All methods as text', LLMS_FULL_PATH, ''),
    '',
    '## Questions',
    '',
    ...QUESTIONS.map(({ question, answer }) => `- ${question} ${answer}`),
  ]
  return lines.join('\n') + '\n'
}

/** One method as a row of a Markdown table. A '|' in a note would end its cell early. */
function methodRow(method: GuideMethod): string {
  const cells = [
    method.level,
    method.name,
    method.rate,
    INTENSITY_LABELS[method.intensity],
    method.audience,
    method.needs || 'nothing',
    method.note.replaceAll('|', '/'),
  ]
  return `| ${cells.join(' | ')} |`
}

/** llms-full.txt: every method of every skill as Markdown tables, for an assistant that wants all of it. */
export function buildLlmsFull(): string {
  const lines = [
    '# Long Game: every OSRS training method',
    '',
    `Adapted from the Old School RuneScape Wiki (${WIKI_URL}), ${DATA_LICENCE.name}. Rates are the wiki’s and assume its listed setups.`,
    '',
  ]
  for (const guide of buildSkillGuides()) {
    lines.push(
      `## ${guide.name}`,
      '',
      '| Level | Method | XP | Attention | For | Needs | Notes |',
      '|---|---|---|---|---|---|---|',
      ...guide.methods.map(methodRow),
      '',
    )
  }
  return lines.join('\n')
}

/** The method data as it is published: each skill's methods, with the licence they carry and where they came from. */
export interface MethodsExport {
  readonly licence: string
  readonly source: string
  readonly skills: Readonly<Partial<Record<SkillKey, readonly Method[]>>>
}

/** /data/methods.json: every method of every skill that has a guide, under the wiki's licence. */
export function buildMethodsExport(): MethodsExport {
  return {
    licence: DATA_LICENCE.name,
    source: `Adapted from the Old School RuneScape Wiki, ${WIKI_URL}`,
    skills: Object.fromEntries(GUIDE_SKILLS.map((skill) => [skill, METHODS[skill]])),
  }
}
