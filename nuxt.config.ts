import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RETURNING_PLAYER_SCRIPT } from './app/utils/returning-player'
import { UNSLASHED_GUIDE_ROUTE, prerenderedRoutes } from './shared/domain/site'
import { NEVER_CACHE, SECURITY_HEADERS } from './shared/domain/site-headers'
import { LOCAL_BUILD_DIRECTORY, LOCAL_OUTPUT_DIRECTORY } from './tools/local-copy/paths.ts'

// The website is written out as files when it is built: the planner's screens as they look on a first visit, every
// training guide, the 404 page and the files for search engines and AI assistants. Each address is named (see
// shared/domain/site.ts), so nothing depends on a crawler finding a link to it. A page written out by a build carries
// that build's settings: NUXT_PUBLIC_SITE_URL has to be the site's address when the website is built, and a copy for
// a player's own machine has to be built with NUXT_PUBLIC_MODE=local, which writes nothing out and leaves every
// page to its own server.
const isLocalBuild = process.env.NUXT_PUBLIC_MODE === 'local'

// A private add-on for one local copy lives in local/, which is never committed (see "Quest progress from a local
// add-on" in docs/ARCHITECTURE.md). It is a Nuxt layer, taken in only when the folder is there and only by a local
// build: the website is built from the published code alone, even on a machine that has the folder.
const hasLocalAddOn =
  isLocalBuild && existsSync(fileURLToPath(new URL('./local/nuxt.config.ts', import.meta.url)))

// Where a local copy finds the saves of the app this one replaced: data/state.json and data/snapshots_<name>.json at
// the top of the project. They are only ever read (server/utils/local-saves.ts). The folder is named relative to
// the folder the server is started from, like Nitro's own `data` mount beside it (./.data/kv), and the launcher
// always starts the server from the top of the project (startLocalCopy in tools/local-copy/steps.ts).
const legacySavesMount = { driver: 'fs-lite', base: './data', readOnly: true }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  extends: hasLocalAddOn ? ['./local'] : [],
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  devtools: { enabled: false },
  typescript: {
    strict: true,
    // the command-line tools are run by Node itself, so they are checked with nuxt.config.ts rather than with the app
    nodeTsConfig: { include: ['../tools/**/*.ts'] },
  },
  // A local copy is built into folders of its own, so building one never disturbs the website's build or a dev
  // server that is running. The website's build folder is left for Nuxt to choose: .nuxt, or a folder under
  // node_modules/.cache when .nuxt is already there, which keeps a build out of a running dev server's way.
  buildDir: isLocalBuild ? LOCAL_BUILD_DIRECTORY : undefined,
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      // the colour a phone's browser draws its own bars in: the ground, --color-ground in tokens.scss
      meta: [{ name: 'theme-color', content: '#191411' }],
      // The mark as files, for anything that asks for an icon by address: a search engine, a bookmark bar, a
      // phone's home screen (written by tools/social/icons.mjs).
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
      // Runs before the page is first painted: a returning player's document is marked, so the first-visit screen
      // the server sent is never shown to them (see app/utils/returning-player.ts).
      script: [{ key: 'returning-player', innerHTML: RETURNING_PLAYER_SCRIPT }],
    },
  },
  css: ['~/assets/styles/main.scss'],
  build: {
    // The stores import Pinia by name so they can be unit tested without Nuxt. Bundling it into the server build
    // keeps that import and the Pinia module's own on one copy; left external, the server would load a second copy
    // that knows nothing of the first one's stores.
    transpile: ['pinia'],
  },
  experimental: {
    // A change of page is animated by the browser's View Transitions API: the yellow line slides between tabs and
    // the page crossfades (app/assets/styles/view-transitions.scss). Nuxt skips it under reduced motion and where
    // the browser has no such API.
    viewTransition: true,
    // 404.html is the real "not found" page (app/error.vue), not an empty shell that draws it in the browser.
    prerenderErrorPages: true,
  },
  // The preset is not named here but by the script that builds (package.json: `build:site` passes
  // cloudflare-module, tools/local-copy/build.ts passes node-server). Named here, a Cloudflare preset would also
  // switch `nuxt dev` over to Cloudflare's emulation.
  nitro: {
    output: isLocalBuild ? { dir: LOCAL_OUTPUT_DIRECTORY } : {},
    prerender: {
      routes: isLocalBuild ? [] : prerenderedRoutes(),
      // each guide is written out once, under its address with the slash at the end
      ignore: [UNSLASHED_GUIDE_ROUTE],
      // /skills is written as skills.html, not skills/index.html. Cloudflare serves a file at the address its name
      // spells and redirects the other spelling to it: skills.html answers /skills, while guides/mining/index.html
      // answers /guides/mining/. With a folder for every page, /skills would be redirected to /skills/.
      autoSubfolderIndex: false,
    },
    // Only a local copy has a disk. Declaring the mount for the website too would put Node's file system code in
    // the Worker.
    storage: isLocalBuild ? { 'legacy-saves': legacySavesMount } : {},
    devStorage: isLocalBuild ? { 'legacy-saves': legacySavesMount } : {},
    // Read by the cloudflare-module preset only.
    cloudflare: {
      // Nitro writes the Worker's configuration next to the built server (.output/server/wrangler.json): the
      // settings in wrangler.jsonc plus where this build put the Worker and its files. Wrangler finds it through
      // .wrangler/deploy/config.json, which the build also writes.
      deployConfig: true,
      // Nothing the Worker runs needs Node's own modules, so the `nodejs_compat` flag stays off and the Worker
      // stays small. deployConfig would otherwise switch it on.
      nodeCompat: false,
    },
  },
  // Each value can be overridden when the server starts with the environment variable named beside it.
  runtimeConfig: {
    // NUXT_GITHUB_TOKEN: a fine-grained token with Issues: write on `githubRepo`. Private: it must never move
    // under `public`. While it is empty the suggestion form answers "not switched on yet".
    githubToken: '',
    // NUXT_GITHUB_REPO: the repository that receives method suggestions, as 'owner/name'. Private, so the pages
    // do not carry it: only the server needs to know where an issue is filed.
    githubRepo: 'ryandewick/longgame',
    public: {
      // NUXT_PUBLIC_MODE: 'hosted' is the website; 'local' is a copy on a player's own machine that saves to disk.
      // A local build keeps the mode it was built with, so its server needs no variable to start as a local copy.
      mode: isLocalBuild ? 'local' : 'hosted',
      // NUXT_PUBLIC_SITE_URL: sent to Jagex and GitHub in the User-Agent, so they can see who is calling
      siteUrl: 'https://longgame.tools',
      // questProgressProvider: whether this copy has an add-on that answers /api/quest-progress. The published code
      // has none, so it is false. An add-on in local/ sets it to true in its own nuxt.config.ts; a value written
      // here would win over the add-on's, so the default is only given when there is no add-on to give one. It
      // counts in local mode only.
      ...(hasLocalAddOn ? {} : { questProgressProvider: false }),
    },
  },
  // The headers on what the server answers itself: the API and any page it draws on request. On Cloudflare the
  // files served from disk (the pages written out by the build, /assets, /_nuxt) never reach the server; their
  // headers, the long cache lifetimes among them, are in the `_headers` file that modules/cloudflare-headers.ts
  // writes. Both read shared/domain/site-headers.ts.
  routeRules: {
    '/**': { headers: SECURITY_HEADERS },
    // API answers are about one player at one moment: nothing between the server and the browser may keep them.
    // The hiscores route replaces this header on success with a one minute lifetime.
    '/api/**': { headers: { 'cache-control': NEVER_CACHE } },
  },
})
