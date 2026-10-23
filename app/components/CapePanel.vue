<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { capeColours } from '#shared/domain/capes'
import type { ListIcon } from '~/utils/assets'

/**
 * The panel at the top of Tonight: a swatch in a skill's cape colour with its trim down the
 * edge, then a headline and whatever the panel is for. The live block, the deal and the finish
 * are all this panel with different contents.
 *
 * Slots: `swatch` hangs in the swatch (a cape, a fan of capes), `default` follows the headline,
 * `actions` is the row of buttons, `aside` is a third column at the right (the clock) and
 * `progress` lies along the bottom edge.
 */
const {
  skill,
  listIcon = null,
  note = '',
} = defineProps<{
  /** The skill whose colours the swatch wears and whose icon leads the headline. Null is the plain cape with a brass trim. */
  skill: SkillKey | null
  /** The quest or diary icon that leads the headline where there is no skill: a quest step's. */
  listIcon?: ListIcon | null
  title: string
  /** One sentence under the headline. */
  note?: string
}>()

const slots = defineSlots<{
  swatch(): unknown
  default?(): unknown
  actions?(): unknown
  aside?(): unknown
  progress?(): unknown
}>()

const titleId = useId()
const colours = computed(() => capeColours(skill))

const body = useTemplateRef('body')
const aside = useTemplateRef('aside')

defineExpose({
  /**
   * Everything the panel says, a line at a time: the headline and what follows it, then the
   * aside. For the panel that brings its content in (see LivePanel).
   */
  contentElements: (): Element[] => [
    ...Array.from(body.value?.children ?? []),
    ...Array.from(aside.value?.children ?? []),
  ],
})
</script>

<template>
  <section
    class="cape-panel"
    :class="{ 'cape-panel--with-aside': slots.aside }"
    :style="{ '--cape-panel-cape': colours.cape, '--cape-panel-trim': colours.trim }"
    :aria-labelledby="titleId"
  >
    <div class="cape-panel__swatch">
      <slot name="swatch" />
    </div>
    <div ref="body" class="cape-panel__body">
      <h2 :id="titleId" class="cape-panel__title">
        <SkillIcon v-if="skill || listIcon" :skill="skill" :list-icon="listIcon" size="large" />
        {{ title }}
      </h2>
      <p v-if="note" class="cape-panel__note">{{ note }}</p>
      <slot />
      <div v-if="slots.actions" class="cape-panel__actions action-row">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="slots.aside" ref="aside" class="cape-panel__aside">
      <slot name="aside" />
    </div>
    <slot name="progress" />
  </section>
</template>

<style lang="scss">
.cape-panel {
  // the progress line and the swatch's contents are placed against the panel
  position: relative;
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  min-height: 226px;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--color-panel);
  box-shadow: 0 0 0 1px var(--color-edge);

  &--with-aside {
    grid-template-columns: 176px minmax(0, 1fr) auto;
  }

  &__swatch {
    position: relative;
    min-height: 150px;
    overflow: hidden;
    border-right: 10px solid var(--cape-panel-trim);
    background: var(--cape-panel-cape);
  }

  &__body {
    min-width: 0;
    padding: 20px 26px 22px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
    font-size: 34px;
    line-height: 1.05;
  }

  &__note {
    max-width: 54ch;
    margin-top: 2px;
    color: var(--color-text-muted);
  }

  &__actions {
    margin-top: 16px;
  }

  &__aside {
    padding: 16px 26px 20px 0;
    text-align: right;
  }

  // on a phone the panel stacks, and the trim moves from the swatch's side to its foot
  @media (max-width: 760px) {
    &,
    &--with-aside {
      grid-template-columns: minmax(0, 1fr);
    }

    &__swatch {
      border-right: 0;
      border-bottom: 8px solid var(--cape-panel-trim);
    }

    &__body {
      padding: 16px 18px 6px;
    }

    &__title {
      font-size: 26px;
    }

    &__aside {
      padding: 8px 18px 20px;
      text-align: left;
    }
  }
}
</style>
