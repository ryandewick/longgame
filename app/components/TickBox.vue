<script setup lang="ts">
/**
 * The one tick box of the app: a quest done, a diary tier done. It is a button that says whether
 * it is pressed. Whatever is put inside it is the box's visible label and is part of the button,
 * so the words can be pressed as well as the box; with nothing inside it is the box alone.
 *
 * A quest whose start matters has a third state between empty and ticked: started, the box half
 * filled from the bottom, as a cape fills from its hem, and pressed "mixed" for a screen reader.
 */
const {
  ticked,
  started = false,
  describedBy = undefined,
  top = false,
} = defineProps<{
  ticked: boolean
  /** Started and not finished. Ignored once ticked. */
  started?: boolean
  /** What a screen reader calls it, state included: 'Ardougne Medium, done'. */
  label: string
  /**
   * The id of what a screen reader reads after the label: a quest's readiness. The label covers
   * the button's words, so anything more it says needs this.
   */
  describedBy?: string
  /**
   * Level the box with the first line of its words, not their middle: for a name with a line
   * under it.
   */
  top?: boolean
}>()

const emit = defineEmits<{
  /** The player pressed the box: whoever holds the state moves it on. */
  toggle: []
}>()

const pressed = computed(() => (ticked ? 'true' : started ? 'mixed' : 'false'))
</script>

<template>
  <button
    type="button"
    class="tick-box"
    :class="{ 'tick-box--top': top }"
    :aria-pressed="pressed"
    :aria-label="label"
    :aria-describedby="describedBy"
    @click="emit('toggle')"
  >
    <span
      class="tick-box__box"
      :class="{ 'tick-box__box--ticked': ticked, 'tick-box__box--started': started && !ticked }"
    >
      <svg v-if="ticked" class="tick-box__tick" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 12.5l4 4 8-9" />
      </svg>
    </span>
    <span v-if="$slots.default" class="tick-box__label"><slot /></span>
  </button>
</template>

<style lang="scss">
.tick-box {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  vertical-align: middle;
  cursor: pointer;

  &--top {
    align-items: flex-start;
  }

  // the box: an empty well, half bone when started, or bone with an ink tick. Never yellow:
  // yellow is reserved. The started half is drawn as an inset shadow, so the box keeps its shape.
  &__box {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: var(--radius);
    background: var(--color-stage);
    box-shadow: inset 0 0 0 1px var(--color-edge-strong);

    &--started {
      box-shadow:
        inset 0 0 0 1px var(--color-text),
        inset 0 -12px 0 var(--color-text);
    }

    &--ticked {
      background: var(--color-text);
      box-shadow: none;
    }
  }

  // Hovering anywhere on the button lights the edge of an empty box: the one place this block
  // lets one element's state change another, because the button is the thing being pointed at.
  &:hover &__box {
    box-shadow: inset 0 0 0 1px var(--color-text);
  }

  &:hover &__box--started {
    box-shadow:
      inset 0 0 0 1px var(--color-text),
      inset 0 -12px 0 var(--color-text);
  }

  &:hover &__box--ticked {
    box-shadow: none;
  }

  // the tick is drawn in the page so that its colour is a token like any other
  &__tick {
    display: block;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: var(--color-ink);
    stroke-width: 3;
  }

  &__label {
    min-width: 0;
  }
}
</style>
