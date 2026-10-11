<script setup lang="ts">
import type { WikiSource } from '#shared/domain/guides'
import { DATA_LICENCE } from '#shared/domain/site'

/**
 * The credit under a guide's table: each wiki page its methods were adapted from, as a link, and
 * the licence the wiki's text is used under.
 */
defineProps<{
  sources: readonly WikiSource[]
}>()
</script>

<template>
  <p class="guide-sources">
    Adapted from the Old School RuneScape Wiki:
    <span v-for="(source, index) in sources" :key="source.title"
      ><a class="guide-sources__link" :href="source.url" rel="noopener">{{ source.title }}</a
      >{{ index < sources.length - 1 ? ', ' : '' }}</span
    >. Rates are the wiki’s and assume its listed setups. Licensed
    <a class="guide-sources__link" :href="DATA_LICENCE.url" rel="license noopener">{{
      DATA_LICENCE.name
    }}</a
    >.
  </p>
</template>

<style lang="scss">
.guide-sources {
  max-width: 96ch;
  margin-top: 22px;
  color: var(--color-text-faint);
  font-size: 13px;

  &__link {
    color: var(--color-text-muted);
  }
}
</style>
