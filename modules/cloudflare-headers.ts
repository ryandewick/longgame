import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { buildHeadersFile, staticFileHeaderRules } from '../shared/domain/site-headers'

/**
 * Writes the website's `_headers` file: the response headers for the files Cloudflare serves from disk without
 * running the Worker (see shared/domain/site-headers.ts).
 *
 * Nitro's Cloudflare preset writes a `_headers` of its own from the route rules. This replaces it, because that one
 * lets two rules set Cache-Control on the same file: builds/latest.json came out as "max-age=1, immutable,
 * max-age=31536000, immutable". The preset's file is written first and this hook is added after the preset's, so
 * this one has the last word.
 */
export default defineNuxtModule({
  meta: { name: 'cloudflare-headers' },
  setup(_options, nuxt) {
    nuxt.hook('nitro:init', (nitro) => {
      // the preset can be spelt with a hyphen or an underscore
      if (nitro.options.preset.replaceAll('_', '-') !== 'cloudflare-module') return
      nitro.hooks.hook('compiled', async () => {
        const rules = staticFileHeaderRules(nuxt.options.app.buildAssetsDir)
        await writeFile(join(nitro.options.output.publicDir, '_headers'), buildHeadersFile(rules))
        nitro.logger.info(
          'Wrote `_headers` for the files Cloudflare serves (modules/cloudflare-headers.ts)',
        )
      })
    })
  },
})
