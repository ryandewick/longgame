import { describe, expect, it } from 'vitest'
import { GUIDES_PATH, buildSkillGuide } from '#shared/domain/guides'
import { HOME_DESCRIPTION, QUESTIONS } from '#shared/domain/site'
import {
  buildHomeStructuredData,
  buildPageHead,
  buildSkillGuideStructuredData,
  buildTrailStructuredData,
  serialiseStructuredData,
  type Crumb,
  type PageSeo,
} from '~~/app/utils/seo'

const SITE = 'https://longgame.tools'

const page: PageSeo = {
  title: 'OSRS Mining training methods 1-99: XP rates for mains and ironmen | Long Game',
  description: 'Mining training in OSRS.',
  path: '/guides/mining/',
}

/** The content of the one meta tag with this name or property. */
function metaContent(head: ReturnType<typeof buildPageHead>, key: string): string | undefined {
  const matches = head.meta.filter((tag) => ('name' in tag ? tag.name : tag.property) === key)
  expect(matches.length, `${key} appears once at most`).toBeLessThanOrEqual(1)
  return matches[0]?.content
}

describe('buildPageHead', () => {
  const head = buildPageHead(`${SITE}/`, page)

  it('uses the title whole, without the app’s own template', () => {
    expect(head.title).toBe(page.title)
    expect(head.titleTemplate).toBeNull()
  })

  it('describes the page to a search engine and names its one address', () => {
    expect(metaContent(head, 'description')).toBe(page.description)
    expect(head.link).toEqual([{ rel: 'canonical', href: `${SITE}/guides/mining/` }])
  })

  it('describes the page to a link preview, with the preview image by its full address', () => {
    expect(metaContent(head, 'og:type')).toBe('website')
    expect(metaContent(head, 'og:site_name')).toBe('Long Game')
    expect(metaContent(head, 'og:title')).toBe(page.title)
    expect(metaContent(head, 'og:description')).toBe(page.description)
    expect(metaContent(head, 'og:url')).toBe(`${SITE}/guides/mining/`)
    expect(metaContent(head, 'og:image')).toBe(`${SITE}/og.png`)
    expect(metaContent(head, 'og:image:width')).toBe('1200')
    expect(metaContent(head, 'og:image:height')).toBe('630')
    expect(metaContent(head, 'twitter:card')).toBe('summary_large_image')
    expect(metaContent(head, 'twitter:title')).toBe(page.title)
    expect(metaContent(head, 'twitter:description')).toBe(page.description)
    expect(metaContent(head, 'twitter:image')).toBe(`${SITE}/og.png`)
  })

  it('has no structured data unless the page brings some', () => {
    expect(head.script).toEqual([])
    const withData = buildPageHead(SITE, { ...page, structuredData: { '@type': 'Thing' } })
    expect(withData.script).toEqual([
      { key: 'structured-data', type: 'application/ld+json', innerHTML: '{"@type":"Thing"}' },
    ])
  })

  it('leaves out everything that needs a full address when the site has none', () => {
    const local = buildPageHead('', page)
    expect(local.link).toEqual([])
    expect(metaContent(local, 'og:url')).toBeUndefined()
    expect(metaContent(local, 'og:image')).toBeUndefined()
    expect(metaContent(local, 'twitter:image')).toBeUndefined()
    expect(metaContent(local, 'description')).toBe(page.description)
  })
})

describe('serialiseStructuredData', () => {
  it('cannot close the script tag it is written into', () => {
    const json = serialiseStructuredData({ note: '</script><script>alert(1)</script>' })
    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toEqual({ note: '</script><script>alert(1)</script>' })
  })
})

describe('buildHomeStructuredData', () => {
  const data = buildHomeStructuredData(SITE)
  const graph = data['@graph'] as Record<string, unknown>[]

  it('names the site, so a search result can show the name in place of the domain', () => {
    expect(graph[0]).toEqual({
      '@type': 'WebSite',
      name: 'Long Game',
      alternateName: ['Long Game OSRS', 'longgame.tools'],
      url: `${SITE}/`,
    })
  })

  it('describes the planner as a free web application', () => {
    expect(data['@context']).toBe('https://schema.org')
    expect(graph[1]).toEqual({
      '@type': 'WebApplication',
      name: 'Long Game',
      description: HOME_DESCRIPTION,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      url: `${SITE}/`,
    })
  })

  it('gives every question on the page with its answer, word for word', () => {
    expect(graph[2]).toEqual({
      '@type': 'FAQPage',
      mainEntity: QUESTIONS.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    })
    expect(QUESTIONS).toHaveLength(10)
  })

  it('claims no ratings or reviews', () => {
    const json = JSON.stringify(data)
    for (const property of ['aggregateRating', 'ratingValue', 'ratingCount', 'review']) {
      expect(json).not.toContain(`"${property}"`)
    }
  })
})

describe('guide structured data', () => {
  const guide = buildSkillGuide('mining')
  const crumbs: Crumb[] = [
    { label: 'Long Game', path: '/' },
    { label: 'Training guides', path: GUIDES_PATH },
    { label: 'Mining' },
  ]
  const trail = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Long Game', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Training guides', item: `${SITE}/guides/` },
      { '@type': 'ListItem', position: 3, name: 'Mining', item: `${SITE}/guides/mining/` },
    ],
  }

  it('describes a skill guide as a free article adapted from the wiki, with its trail', () => {
    expect(buildSkillGuideStructuredData(SITE, guide, crumbs)).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: 'Mining training methods, level 1 to 99',
          description: guide.description,
          about: 'Old School RuneScape Mining',
          isAccessibleForFree: true,
          license: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
          isBasedOn: 'https://oldschool.runescape.wiki/',
          url: `${SITE}/guides/mining/`,
          image: `${SITE}/og.png`,
        },
        trail,
      ],
    })
  })

  it('describes a page with only a trail by that trail, ending at the page itself', () => {
    expect(buildTrailStructuredData(SITE, crumbs, '/guides/mining/')).toEqual({
      '@context': 'https://schema.org',
      ...trail,
    })
  })
})
