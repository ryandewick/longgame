import type { SkillGuide } from '#shared/domain/guides'
import {
  DATA_LICENCE,
  HOME_DESCRIPTION,
  PREVIEW_IMAGE,
  QUESTIONS,
  SITE_NAME,
  WIKI_URL,
  absoluteUrl,
  normaliseSiteUrl,
} from '#shared/domain/site'

/*
 * What a public page tells a search engine and a link preview about itself: the tags in its
 * head, and its structured data. Pure, so the exact tags can be tested; `usePageSeo` puts them
 * on the page.
 */

/** A schema.org description of a page, as plain JSON. */
export type StructuredData = Readonly<Record<string, unknown>>

/** One step of the trail to a page: its name, and its path when the step is a link. */
export interface Crumb {
  readonly label: string
  readonly path?: string
}

export interface PageSeo {
  /** The whole title, as a search result shows it. */
  readonly title: string
  readonly description: string
  /** The page's own path, ending in a slash: '/guides/mining/'. */
  readonly path: string
  readonly structuredData?: StructuredData
}

/** The head of a page, in the shape `useHead` takes. */
export interface PageHead {
  title: string
  /** Null, so the title is used whole: these titles already carry the site's name. */
  titleTemplate: null
  meta: ({ name: string; content: string } | { property: string; content: string })[]
  link: { rel: 'canonical'; href: string }[]
  script: { key: string; type: 'application/ld+json'; innerHTML: string }[]
}

/**
 * JSON for a script tag. A '<' is written as its escape, so nothing in the data (a method's
 * note, say) can close the tag early.
 */
export function serialiseStructuredData(data: StructuredData): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}

/**
 * The head tags of a public page: title and description, the canonical address, and what a link
 * preview on a social network or in a chat shows. Without a site address there is nothing
 * absolute to point at, so the canonical link and the image are left out.
 */
export function buildPageHead(siteUrl: string, page: PageSeo): PageHead {
  const hasSiteUrl = normaliseSiteUrl(siteUrl) !== ''
  const url = absoluteUrl(siteUrl, page.path)
  const image = absoluteUrl(siteUrl, PREVIEW_IMAGE.path)
  return {
    title: page.title,
    titleTemplate: null,
    meta: [
      { name: 'description', content: page.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: page.title },
      { property: 'og:description', content: page.description },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: page.title },
      { name: 'twitter:description', content: page.description },
      ...(hasSiteUrl
        ? [
            { property: 'og:url', content: url },
            { property: 'og:image', content: image },
            { property: 'og:image:width', content: String(PREVIEW_IMAGE.width) },
            { property: 'og:image:height', content: String(PREVIEW_IMAGE.height) },
            { name: 'twitter:image', content: image },
          ]
        : []),
    ],
    link: hasSiteUrl ? [{ rel: 'canonical', href: url }] : [],
    script: page.structuredData
      ? [
          {
            key: 'structured-data',
            type: 'application/ld+json',
            innerHTML: serialiseStructuredData(page.structuredData),
          },
        ]
      : [],
  }
}

/** The trail to a page as a schema.org BreadcrumbList: what a search result shows in place of the address. */
function breadcrumbList(siteUrl: string, crumbs: readonly Crumb[], path: string): StructuredData {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      // the last step has no path of its own: it is the page itself
      item: absoluteUrl(siteUrl, crumb.path ?? path),
    })),
  }
}

/** Structured data for a page with only its trail to describe: the guide index and the AFK page. */
export function buildTrailStructuredData(
  siteUrl: string,
  crumbs: readonly Crumb[],
  path: string,
): StructuredData {
  return { '@context': 'https://schema.org', ...breadcrumbList(siteUrl, crumbs, path) }
}

/**
 * Structured data for a skill's guide: an article about that skill, free to read, adapted from
 * the wiki under its licence, and the trail to it.
 */
export function buildSkillGuideStructuredData(
  siteUrl: string,
  guide: SkillGuide,
  crumbs: readonly Crumb[],
): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: guide.heading,
        description: guide.description,
        about: `Old School RuneScape ${guide.name}`,
        isAccessibleForFree: true,
        license: DATA_LICENCE.url,
        isBasedOn: WIKI_URL,
        url: absoluteUrl(siteUrl, guide.path),
        image: absoluteUrl(siteUrl, PREVIEW_IMAGE.path),
      },
      breadcrumbList(siteUrl, crumbs, guide.path),
    ],
  }
}

/**
 * Structured data for the home page: the planner as a free web application, and the questions
 * with their answers exactly as the page shows them. No ratings or reviews: there are none.
 */
export function buildHomeStructuredData(siteUrl: string): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        description: HOME_DESCRIPTION,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
        url: absoluteUrl(siteUrl, '/'),
      },
      {
        '@type': 'FAQPage',
        mainEntity: QUESTIONS.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }
}
