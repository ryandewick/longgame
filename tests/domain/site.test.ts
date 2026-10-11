import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { METHODS } from '#shared/data/methods'
import { skillName } from '#shared/data/skills'
import {
  AFK_GUIDE_PATH,
  GUIDES_PATH,
  GUIDE_SKILLS,
  buildSkillGuides,
  guideMethodCount,
  guidePath,
  isGuideSkill,
} from '#shared/domain/guides'
import {
  HOME_DESCRIPTION,
  PLANNER_PATHS,
  QUESTIONS,
  SITE_FILE_PATHS,
  UNSLASHED_GUIDE_ROUTE,
  absoluteUrl,
  buildLlmsFull,
  buildLlmsSummary,
  buildMethodsExport,
  buildRobots,
  buildSitemap,
  normaliseSiteUrl,
  prerenderedRoutes,
  publicPagePaths,
} from '#shared/domain/site'

const SITE = 'https://longgame.tools'
const PROJECT = new URL('../../', import.meta.url)

describe('the site address', () => {
  it('loses any slash at its end, so a path follows it cleanly', () => {
    expect(normaliseSiteUrl('https://longgame.tools/')).toBe(SITE)
    expect(normaliseSiteUrl(' https://longgame.tools// ')).toBe(SITE)
    expect(absoluteUrl('https://longgame.tools/', '/guides/mining/')).toBe(
      'https://longgame.tools/guides/mining/',
    )
  })
})

describe('the public pages', () => {
  it('are the planner, the guide index, the AFK page and a guide for each skill', () => {
    expect(publicPagePaths()).toEqual([
      '/',
      GUIDES_PATH,
      AFK_GUIDE_PATH,
      ...GUIDE_SKILLS.map(guidePath),
    ])
    expect(publicPagePaths()).toHaveLength(26)
  })
})

describe('the routes written out by the build', () => {
  const routes = prerenderedRoutes()

  it('name each address once', () => {
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('include every planner screen, every public page, the 404 page and the files for machines', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        ...PLANNER_PATHS,
        ...publicPagePaths(),
        '/404.html',
        ...SITE_FILE_PATHS,
      ]),
    )
    expect(PLANNER_PATHS).toEqual([
      '/',
      '/skills',
      '/methods',
      '/quests',
      '/resets',
      '/history',
      '/settings',
    ])
  })

  it('are what nuxt.config.ts hands to the prerenderer', () => {
    const config = readFileSync(new URL('nuxt.config.ts', PROJECT), 'utf8')
    expect(config).toMatch(/routes: isLocalBuild \? \[\] : prerenderedRoutes\(\),/)
    expect(config).toContain('ignore: [UNSLASHED_GUIDE_ROUTE]')
  })

  it('leave out the spelling of a guide address that has no slash at its end', () => {
    for (const route of ['/guides', '/guides/afk', '/guides/mining']) {
      expect(UNSLASHED_GUIDE_ROUTE.test(route), route).toBe(true)
    }
    const kept = [...routes, '/guides/afk/_payload.json', '/guides/_payload.json', '/skills']
    for (const route of kept) expect(UNSLASHED_GUIDE_ROUTE.test(route), route).toBe(false)
  })

  /** The page file that draws an address, as Nuxt's file-based routing would find it. */
  function pageFile(path: string): string | undefined {
    const route = path.replace(/^\/|\/$/g, '')
    const [section = '', page] = route.split('/')
    const candidates = page
      ? [`${section}/${page}.vue`, ...(isGuideSkill(page) ? [`${section}/[skill].vue`] : [])]
      : [`${section || 'index'}.vue`, `${section}/index.vue`, `${section}/[[skill]].vue`]
    return candidates.find((file) => existsSync(new URL(`app/pages/${file}`, PROJECT)))
  }

  it('each have a page or a server route to draw them', () => {
    for (const path of [...PLANNER_PATHS, ...publicPagePaths()]) {
      expect(pageFile(path), `a page for ${path}`).toBeDefined()
    }
    for (const path of SITE_FILE_PATHS) {
      const route = new URL(`server/routes${path}.get.ts`, PROJECT)
      expect(existsSync(route), `a server route for ${path}`).toBe(true)
    }
    expect(existsSync(new URL('app/error.vue', PROJECT)), 'the page 404.html is drawn from').toBe(
      true,
    )
  })
})

describe('buildSitemap', () => {
  const sitemap = buildSitemap(SITE)
  const addresses = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')

  it('is a sitemap of every public page, by its full address', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns=')).toBe(true)
    expect(sitemap.endsWith('</urlset>\n')).toBe(true)
    expect(addresses).toEqual(publicPagePaths().map((path) => SITE + path))
  })

  it('lists only addresses the build writes out as pages', () => {
    const routes = prerenderedRoutes()
    for (const address of addresses) {
      expect(address.startsWith(`${SITE}/`)).toBe(true)
      expect(routes, address).toContain(address.slice(SITE.length))
    }
  })

  it('leaves out the planner screens that are a player’s own, and the files for machines', () => {
    for (const path of [...PLANNER_PATHS.filter((path) => path !== '/'), ...SITE_FILE_PATHS]) {
      expect(addresses).not.toContain(SITE + path)
    }
  })

  it('escapes an address for XML', () => {
    expect(buildSitemap('https://example.test/?a=1&b=2')).toContain(
      '<loc>https://example.test/?a=1&amp;b=2/</loc>',
    )
  })
})

describe('buildRobots', () => {
  it('allows everything but the API and points at the sitemap', () => {
    expect(buildRobots('https://longgame.tools/')).toBe(
      'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://longgame.tools/sitemap.xml\n',
    )
  })
})

describe('buildLlmsSummary', () => {
  const summary = buildLlmsSummary(SITE)
  const lines = summary.split('\n')

  it('opens with the name, the description and what the planner is', () => {
    expect(lines.slice(0, 3)).toEqual(['# Long Game', '', `> ${HOME_DESCRIPTION}`])
    expect(lines[4]).toMatch(/^Long Game is a free, browser-based planner for Old School RuneScape/)
  })

  it('states the facts worth repeating, with the method count from the data', () => {
    expect(summary).toContain(
      '## Key facts\n\n' +
        '- Free. No adverts, no login, no password. Only a display name is needed.\n' +
        '- Player data stays in the player’s browser.\n' +
        `- ${guideMethodCount()} training methods across 23 skills, adapted from the Old School RuneScape Wiki under CC BY-NC-SA 3.0.\n` +
        '- The list of methods is not complete. Anyone can suggest one, and it is checked against the wiki before it is added.\n' +
        '- Quests and diaries are not on the hiscores, so the planner asks about the few that would change a player’s plan. Which quests require which is adapted from the same wiki, under the same licence.\n' +
        '- A fan project. Not endorsed by or affiliated with Jagex.\n',
    )
  })

  it('links every public page', () => {
    expect(summary).toContain(`- [Planner](${SITE}/): the app\n`)
    expect(summary).toContain(
      `- [Training guides](${SITE}/guides/): every method for every skill\n`,
    )
    expect(summary).toContain(
      `- [AFK methods](${SITE}/guides/afk/): every AFK method across all skills\n`,
    )
    for (const skill of GUIDE_SKILLS) {
      const methods = METHODS[skill]
      expect(summary).toContain(
        `- [${skillName(skill)} training](${SITE}/guides/${skill}/): ${methods.length} methods, level ${methods[0]?.level} to 99\n`,
      )
    }
    for (const path of publicPagePaths()) expect(summary).toContain(`](${SITE}${path})`)
  })

  it('links the data in both its forms', () => {
    expect(summary).toContain(
      `## Data\n\n- [All methods as JSON](${SITE}/data/methods.json)\n- [All methods as text](${SITE}/llms-full.txt)\n`,
    )
  })

  it('ends with every question and its answer', () => {
    const questions = QUESTIONS.map(({ question, answer }) => `- ${question} ${answer}`)
    expect(summary.endsWith(`## Questions\n\n${questions.join('\n')}\n`)).toBe(true)
    expect(summary).toContain('- How does it know which quests I have done? It asks. The public')
    expect(summary).toContain('- Is every training method listed? No. Every method listed was')
  })
})

describe('buildLlmsFull', () => {
  const full = buildLlmsFull()

  it('credits the wiki and names the licence before anything else', () => {
    expect(full.startsWith('# Long Game: every OSRS training method\n\n')).toBe(true)
    expect(full).toContain(
      'Adapted from the Old School RuneScape Wiki (https://oldschool.runescape.wiki/), CC BY-NC-SA 3.0. Rates are the wiki’s and assume its listed setups.',
    )
  })

  it('has a table for every skill, with a row for every method', () => {
    const sections = full.split('\n## ').slice(1)
    expect(sections.map((section) => section.split('\n')[0])).toEqual(GUIDE_SKILLS.map(skillName))
    for (const [index, guide] of buildSkillGuides().entries()) {
      const rows = (sections[index] ?? '').split('\n').filter((line) => line.startsWith('| '))
      expect(rows[0]).toBe('| Level | Method | XP | Attention | For | Needs | Notes |')
      // the heading row, then one row for each method
      expect(rows).toHaveLength(guide.methods.length + 1)
    }
  })

  it('writes a method as level, name, rate, attention, audience, needs and note', () => {
    const [first] = buildSkillGuides()
    const method = first?.methods[0]
    expect(method).toBeDefined()
    if (!method) return
    expect(full).toContain(`| ${method.level} | ${method.name} | ${method.rate} | `)
    expect(full).toMatch(/\| (AFK|Semi-AFK|Active) \| (Everyone|Mains|Ironmen) \| /)
    // a method that needs nothing says so, so no cell is left empty
    expect(full).toContain(' | nothing | ')
  })

  it('keeps every row to seven cells, whatever is in a note', () => {
    for (const row of full.split('\n').filter((line) => line.startsWith('| '))) {
      expect(row.split(' | ')).toHaveLength(7)
    }
  })
})

describe('buildMethodsExport', () => {
  const published = buildMethodsExport()

  it('carries its licence and where the data came from', () => {
    expect(published.licence).toBe('CC BY-NC-SA 3.0')
    expect(published.source).toBe(
      'Adapted from the Old School RuneScape Wiki, https://oldschool.runescape.wiki/',
    )
  })

  it('holds every method of every skill that has a guide', () => {
    expect(Object.keys(published.skills)).toEqual(GUIDE_SKILLS)
    for (const skill of GUIDE_SKILLS) expect(published.skills[skill]).toBe(METHODS[skill])
  })

  it('is plain JSON', () => {
    expect(JSON.parse(JSON.stringify(published))).toEqual(published)
  })
})
