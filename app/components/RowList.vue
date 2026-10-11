<script setup lang="ts" generic="Item">
/**
 * A short list of rows that each lead with a small picture (a skill's icon, a cape), then a
 * name, then whatever the row is for (a figure, a status, a button) at the right. The lists
 * beside the session on Tonight and the tally of a finished session are all one of these.
 */
defineProps<{
  items: readonly Item[]
  /** What tells one item from another, for keeping rows in place when the list changes. */
  itemKey: (item: Item) => string
}>()

defineSlots<{
  /** The picture the row leads with. */
  lead?(props: { item: Item }): unknown
  /** The row's name. */
  default(props: { item: Item }): unknown
  /** What follows the name, at the right. */
  trail?(props: { item: Item }): unknown
}>()

const list = useTemplateRef('list')

defineExpose({
  /** The rows, top to bottom. For the list that brings its rows in (see SessionTally). */
  rowElements: (): Element[] => Array.from(list.value?.children ?? []),
})
</script>

<template>
  <!-- named a list outright: some browsers stop announcing one once its markers are styled away -->
  <ul ref="list" class="row-list" role="list">
    <li v-for="item in items" :key="itemKey(item)" class="row-list__row">
      <slot name="lead" :item="item" />
      <span class="row-list__name"><slot :item="item" /></span>
      <slot name="trail" :item="item" />
    </li>
  </ul>
</template>

<style lang="scss">
.row-list {
  margin: 0;
  padding: 0;
  list-style: none;

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    padding: 4px 0;
  }

  // takes the room between the picture and whatever sits at the right
  &__name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }
}
</style>
