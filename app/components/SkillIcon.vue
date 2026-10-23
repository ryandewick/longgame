<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import type { ListIcon } from '~/utils/assets'

/**
 * A skill's icon from the game, at its own pixel size so the pixels stay square. A quest step
 * shows the game's quest or diary icon and a wildcard its "?"; with none of them it is an empty
 * slot, so rows of icons stay aligned.
 */
const {
  skill = null,
  listIcon = null,
  size = 'row',
  title = undefined,
} = defineProps<{
  skill?: SkillKey | null
  /** Show the game's quest or diary icon in place of a skill. */
  listIcon?: ListIcon | null
  /** Show the wildcard's "?" in place of a skill. */
  wildcard?: boolean
  /** 25px in a row, 32px beside a headline, 18px inside a chip. */
  size?: 'row' | 'large' | 'chip'
  /** Dimmed, for a row the account cannot use yet. */
  faded?: boolean
  title?: string
}>()
</script>

<template>
  <span
    class="skill-icon"
    :class="{
      'skill-icon--large': size === 'large',
      'skill-icon--chip': size === 'chip',
      'skill-icon--wildcard': !skill && !listIcon && wildcard,
      'skill-icon--faded': faded,
    }"
    :title="title"
  >
    <img
      v-if="skill || listIcon"
      class="skill-icon__image"
      :class="{
        'skill-icon__image--large': size === 'large',
        'skill-icon__image--chip': size === 'chip',
      }"
      :src="skill ? skillIconUrl(skill) : questListIconUrl(listIcon ?? 'quest')"
      alt=""
    />
    <template v-else-if="wildcard">?</template>
  </span>
</template>

<style lang="scss">
.skill-icon {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 25px;
  height: 25px;
  vertical-align: middle;

  &--large {
    width: 32px;
    height: 32px;
  }

  &--chip {
    width: 18px;
    height: 18px;
    // a chip is sized by its text, not by the icon
    margin-block: -2px;
  }

  &--wildcard {
    color: var(--color-text);
    font: 16px/1 var(--font-game);
    text-shadow: 1px 1px 0 var(--color-black);
  }

  &--faded {
    opacity: 0.45;
  }

  &__image {
    display: block;
    image-rendering: pixelated;

    &--large {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }

    &--chip {
      max-width: 18px;
      max-height: 18px;
    }
  }
}
</style>
