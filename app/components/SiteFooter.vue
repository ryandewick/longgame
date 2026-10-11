<script setup lang="ts">
/**
 * The footer: the credit Jagex's Fan Content Policy asks for, word for word, and the licence the
 * wiki's data is used under. The repository link shows when `runtimeConfig.public.githubRepo`
 * names one. The website also says how its visits are counted; a local copy counts none.
 */
const { githubRepo } = useRuntimeConfig().public
const isWebsite = useAppMode() === 'hosted'
</script>

<template>
  <footer class="site-footer page-width">
    <p class="site-footer__line">
      Long Game is a free fan project. Created using intellectual property belonging to Jagex
      Limited under the terms of Jagex’s Fan Content Policy. This content is not endorsed by or
      affiliated with Jagex.
    </p>
    <p class="site-footer__line">
      Training methods, rates and quest requirements are adapted from the
      <a class="site-footer__link" href="https://oldschool.runescape.wiki/" rel="noopener"
        >Old School RuneScape Wiki</a
      >, used under
      <a
        class="site-footer__link"
        href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
        rel="noopener"
        >CC BY-NC-SA 3.0</a
      >. The <a class="site-footer__link" href="/data/methods.json">method data</a> is published
      under the same licence.
      <template v-if="githubRepo">
        The code and the data are on
        <a class="site-footer__link" :href="`https://github.com/${githubRepo}`" rel="noopener"
          >GitHub</a
        >.
      </template>
    </p>
    <p v-if="isWebsite" class="site-footer__line">
      Visits are counted with Cloudflare Web Analytics, which sets no cookies and does not follow
      you to other sites.
    </p>
  </footer>
</template>

<style lang="scss">
.site-footer {
  padding-top: 22px;
  padding-bottom: 40px;
  border-top: 1px solid var(--color-edge);
  color: var(--color-text-faint);
  font-size: 13px;

  &__line {
    max-width: 96ch;

    & + & {
      margin-top: 6px;
    }
  }

  &__link {
    color: var(--color-text-muted);
  }
}
</style>
