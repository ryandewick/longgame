<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { skillName } from '#shared/data/skills'
import { capeColours } from '#shared/domain/capes'

/**
 * The head of a guide page: the page's one heading and the sentences under it. A skill's guide
 * also wears that skill's cape, hanging on a crest in the cape's own colours, and its icon
 * beside the heading.
 */
const { skill = null } = defineProps<{
  heading: string
  /** The sentences under the heading, each a paragraph. Empty ones are left out. */
  paragraphs: readonly string[]
  /** The skill the page is about; left out on a page about all of them. */
  skill?: SkillKey | null
}>()

/** The size the cape is drawn at, given to the browser so the page does not move when it loads. */
const CAPE_SIZE = { width: 88, height: 171 } as const

const colours = computed(() => capeColours(skill))
</script>

<template>
  <div class="guide-header" :class="{ 'guide-header--with-crest': skill }">
    <div
      v-if="skill"
      class="guide-header__crest"
      :style="{
        '--guide-header-cape': colours.cape,
        '--guide-header-trim': colours.trim,
      }"
    >
      <img
        class="guide-header__cape"
        :src="capeImageUrl(skill)"
        :alt="`${skillName(skill)} skillcape`"
        :width="CAPE_SIZE.width"
        :height="CAPE_SIZE.height"
      />
    </div>
    <div class="guide-header__text">
      <h1 class="guide-header__heading">
        <SkillIcon v-if="skill" :skill="skill" size="large" />
        {{ heading }}
      </h1>
      <template v-for="paragraph in paragraphs" :key="paragraph">
        <p v-if="paragraph" class="guide-header__paragraph">{{ paragraph }}</p>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
.guide-header {
  margin-bottom: 8px;

  &--with-crest {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    align-items: center;
    gap: 28px;
  }

  // the skill's cape colour as a field, its trim as a band along the bottom
  &__crest {
    position: relative;
    height: 196px;
    overflow: hidden;
    border-bottom: 10px solid var(--guide-header-trim);
    border-radius: var(--radius);
    background: var(--guide-header-cape);
  }

  &__cape {
    position: absolute;
    top: 10px;
    left: calc(50% - 44px);
    width: 88px;
    height: auto;
    filter: drop-shadow(var(--shadow-cape-hanging));
  }

  &__text {
    min-width: 0;
  }

  &__heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 34px;
    line-height: 1.05;
  }

  &__paragraph {
    max-width: 70ch;
    color: var(--color-text-muted);

    & + & {
      margin-top: 8px;
    }
  }

  // Phones: the crest goes, and the icon beside the heading is the skill's picture.
  @media (max-width: 760px) {
    &--with-crest {
      grid-template-columns: minmax(0, 1fr);
    }

    &__crest {
      display: none;
    }

    &__heading {
      font-size: 28px;
    }
  }
}
</style>
