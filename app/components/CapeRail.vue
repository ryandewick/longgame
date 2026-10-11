<script setup lang="ts">
import { NuxtLink } from '#components'
import type { SkillKey } from '#shared/types/skill'
import { capeFillPercent, fillShareAtLevel } from '#shared/domain/capes'
import { formatNumber } from '#shared/domain/format'
import { MAX_LEVEL } from '#shared/domain/xp'
import type { MotionTimeline } from '~/composables/useMotion'

/** One cape on the rail. */
export interface RailCape {
  readonly skill: SkillKey
  readonly level: number
  /** What the cape says for itself, as its tooltip and its name: "Mining 63, 12k xp to 64". */
  readonly description?: string
}

/** What a cape gained in the session just tallied, for `showGains`. */
export interface RailGain {
  readonly skill: SkillKey
  readonly xp: number
  /** The skill's level when the session was dealt: the cape fills from there. */
  readonly levelBefore: number
}

/**
 * The brass rail with a skillcape for each entry of `capes`, in the order given, each filled
 * with colour as far as its level, and the max cape at the end. The capes overlap like clothes
 * on a rack; on a phone they hang in rows of twelve.
 *
 * It only draws what it is handed. With `interactive` every cape is a link to its skill;
 * without, the rail is a picture (the demonstration on the setup screen) and is hidden from
 * screen readers, to whom a row of bare numbers would say nothing.
 *
 * The rail moves three ways, each a method whoever hangs it calls at the right moment (see
 * useMotion): `fillFromEmpty`, `bringCurrentForward` and `showGains`. It is complete, and still,
 * if none is ever called.
 */
const {
  capes,
  currentSkill = null,
  interactive = false,
  maxCapeDescription = undefined,
} = defineProps<{
  capes: readonly RailCape[]
  /** How much of the max cape is in colour, 0 to 100. */
  maxCapeFill: number
  /** Every skill is 99: the max cape gets the glow of a finished cape. */
  maxCapeComplete?: boolean
  maxCapeDescription?: string
  /** The cape to bring forward: the live block's skill, or the one selected on Skills. */
  currentSkill?: SkillKey | null
  interactive?: boolean
}>()

/** On a phone the capes hang in rows of this many. */
const CAPES_PER_PHONE_ROW = 12

/** At the tally a cape's XP takes this long to rise off it, then hangs above it this long before it fades. */
const XP_RISE_SECONDS = 1.1
const XP_HANG_SECONDS = 1.2

/** The capes that gained in the session just tallied, for as long as their XP is rising off them. */
const risingGains = shallowRef<readonly RailGain[]>([])

const hangingCapes = computed(() =>
  capes.map((cape, index) => ({
    ...cape,
    xpGained: risingGains.value.find((gain) => gain.skill === cape.skill)?.xp ?? null,
    fill: capeFillPercent(cape.level),
    isMaxed: cape.level >= MAX_LEVEL,
    isCurrent: cape.skill === currentSkill,
    isFirst: index === 0,
    startsPhoneRow: index % CAPES_PER_PHONE_ROW === 0,
    endsPhoneRow: index % CAPES_PER_PHONE_ROW === CAPES_PER_PHONE_ROW - 1,
  })),
)

// a link when the rail can be used, a plain span when it is only a picture
const capeTag = computed(() => (interactive ? NuxtLink : 'span'))

const motion = useMotion()
// Each of these is told apart by its skill: the picture by its own `skill`, the plain elements by
// `data-skill`. Vue does not promise to keep a list of references in the order of the capes.
const capeImages = useTemplateRef('capeImages')
const maxCapeImage = useTemplateRef('maxCapeImage')
const hangers = useTemplateRef('hangers')
const xpDrops = useTemplateRef('xpDrops')

/** The XP rising off the capes, kept so that a second tally would start it again rather than run beside it. */
let risingXp: MotionTimeline | null = null

function capeImageOf(skill: SkillKey) {
  return capeImages.value?.find((image) => image?.$props.skill === skill)
}

/** First load: every cape fills from empty to its level, one after another along the rail, the max cape last. */
function fillFromEmpty(): void {
  const timingAt = (place: number) => ({ duration: 0.9, delay: 0.2 + place * 0.025 })
  hangingCapes.value.forEach((cape, place) => capeImageOf(cape.skill)?.fillFrom(0, timingAt(place)))
  maxCapeImage.value?.fillFrom(0, timingAt(capes.length))
}

/** The hanger last brought forward, in case another cape is called for before it has arrived. */
let cameForward: HTMLElement | undefined

/** A block goes live: its cape, the current one, comes forward off the rail and a little past where it rests. */
function bringCurrentForward(): void {
  const hanger = hangers.value?.find((element) => element.dataset.skill === currentSkill)
  // a cape that is no longer the current one drops straight back, rather than finish coming forward
  if (cameForward !== hanger) motion.rest(cameForward)
  cameForward = hanger
  motion.arrive(hanger, { y: 0, scale: 1 }, { duration: 0.45, ease: 'back.out(2)' })
}

/**
 * The tally: each cape that gained fills from the level it started at to the level it is now,
 * while its XP rises off it and fades, the way the game shows an XP drop.
 */
async function showGains(gains: readonly RailGain[]): Promise<void> {
  // the XP is only ever in the page to rise off a cape, so with nothing to move it is not drawn
  if (prefersReducedMotion()) return
  risingGains.value = gains
  await nextTick()
  const delayAt = (place: number): number => 0.2 + place * 0.08

  gains.forEach((gain, place) => {
    const cape = capes.find((hanging) => hanging.skill === gain.skill)
    const shareBefore = cape ? fillShareAtLevel(gain.levelBefore, cape.level) : 1
    if (shareBefore < 1) {
      capeImageOf(gain.skill)?.fillFrom(shareBefore, { duration: 1.2, delay: delayAt(place) })
    }
  })

  motion.play((tweens) => {
    risingXp?.kill()
    const rising = tweens.timeline({
      onComplete: () => {
        risingGains.value = []
      },
    })
    gains.forEach((gain, place) => {
      const drop = xpDrops.value?.find((element) => element.dataset.skill === gain.skill)
      if (!drop) return
      const start = delayAt(place)
      rising
        .fromTo(
          drop,
          { y: 30, autoAlpha: 0 },
          { y: -18, autoAlpha: 1, duration: XP_RISE_SECONDS, ease: 'power1.out' },
          start,
        )
        // it hangs above the cape for a moment before it goes
        .to(drop, { autoAlpha: 0, duration: 0.5 }, start + XP_RISE_SECONDS + XP_HANG_SECONDS)
    })
    risingXp = rising
  })
}

defineExpose({ fillFromEmpty, bringCurrentForward, showGains })
</script>

<template>
  <div
    class="cape-rail"
    :style="{ '--cape-rail-count': capes.length }"
    :aria-hidden="interactive ? undefined : 'true'"
  >
    <component
      :is="capeTag"
      v-for="cape in hangingCapes"
      :key="cape.skill"
      class="cape-rail__cape"
      :class="{
        'cape-rail__cape--interactive': interactive,
        'cape-rail__cape--current': cape.isCurrent,
        'cape-rail__cape--first': cape.isFirst,
        'cape-rail__cape--row-start': cape.startsPhoneRow,
        'cape-rail__cape--row-end': cape.endsPhoneRow,
      }"
      :to="interactive ? `/skills/${cape.skill}` : undefined"
      :title="cape.description"
      :aria-label="cape.description"
      :aria-current="interactive && cape.isCurrent ? 'true' : undefined"
    >
      <span
        ref="hangers"
        class="cape-rail__hanger"
        :class="{
          'cape-rail__hanger--maxed': cape.isMaxed,
          'cape-rail__hanger--current': cape.isCurrent,
          'cape-rail__hanger--liftable': interactive && !cape.isCurrent,
        }"
        :data-skill="cape.skill"
      >
        <CapeImage ref="capeImages" :skill="cape.skill" :fill="cape.fill" :trimmed="cape.isMaxed" />
      </span>
      <GameNumber
        class="cape-rail__level"
        :class="{ 'cape-rail__level--current': cape.isCurrent }"
        :tone="cape.isCurrent ? 'white' : 'stat'"
      >
        {{ cape.level }}
      </GameNumber>
      <!-- only here while it rises: see showGains -->
      <span
        v-if="cape.xpGained !== null"
        ref="xpDrops"
        class="cape-rail__xp-drop"
        :data-skill="cape.skill"
        aria-hidden="true"
      >
        <GameNumber tone="white">+{{ formatNumber(cape.xpGained) }} xp</GameNumber>
      </span>
    </component>

    <span class="cape-rail__gap" />
    <span class="cape-rail__gap" />

    <component
      :is="capeTag"
      class="cape-rail__cape cape-rail__cape--goal"
      :class="{ 'cape-rail__cape--interactive': interactive }"
      :to="interactive ? '/skills' : undefined"
      :title="maxCapeDescription"
    >
      <span
        class="cape-rail__hanger cape-rail__hanger--goal"
        :class="{ 'cape-rail__hanger--maxed': maxCapeComplete }"
      >
        <CapeImage ref="maxCapeImage" :skill="null" :fill="maxCapeFill" />
      </span>
      <GameNumber class="cape-rail__level cape-rail__level--goal" tone="white" wrapping>
        Max cape
      </GameNumber>
    </component>
  </div>
</template>

<style lang="scss">
.cape-rail {
  // one column per cape, two empty ones before the max cape, and two for the max cape itself
  display: grid;
  grid-template-columns: repeat(calc(var(--cape-rail-count) + 4), minmax(0, 1fr));
  padding-left: 8px;
  // the rail is drawn behind the capes without slipping behind the band they hang in
  isolation: isolate;

  &__cape,
  &__gap {
    position: relative;
    min-width: 0;

    // The rail: each column draws its own length of it, behind the top of its cape.
    &::before {
      content: '';
      position: absolute;
      top: 6px;
      right: 0;
      left: 0;
      z-index: -1;
      height: 6px;
      background: linear-gradient(
        var(--color-brass-light),
        var(--color-brass) 45%,
        var(--color-brass-dark)
      );
      box-shadow: var(--shadow-rail);
    }
  }

  &__cape {
    display: block;
    color: inherit;
    text-align: center;
    text-decoration: none;

    &:focus-visible {
      outline-offset: -2px;
    }

    // A cape that can be pressed holds its picture and level in the middle of its cell, the way a
    // button holds its label. It shows on a phone, where the max cape's label takes two lines and
    // makes the second row deeper than the capes in it.
    &--interactive {
      display: flex;
      flex-direction: column;
      justify-content: center;
      cursor: pointer;
    }

    // the rail runs on past the first cape and past the max cape, with rounded ends
    &--first::before {
      left: -48px;
      border-radius: 3px 0 0 3px;
    }

    &--goal {
      grid-column: span 2;

      &::before {
        right: -40px;
        border-radius: 0 3px 3px 0;
      }
    }

    &--current {
      z-index: 5;
    }
  }

  // A cape is twice as wide as its column, so each overlaps the next.
  &__hanger {
    display: block;
    width: 200%;
    transform-origin: 50% 0;
    transition: transform 0.16s var(--ease-out);
    pointer-events: none;

    &--goal {
      width: 100%;
      transform: scale(1.12);
    }

    &--maxed {
      filter: drop-shadow(0 0 10px var(--color-cape-glow));
    }

    // the cape of the block to do now comes forward, as if lifted off the rail
    &--current {
      transform: translateY(6px) scale(1.1);
      filter: drop-shadow(var(--shadow-cape-forward));
    }
  }

  // A cape that can be clicked drops a little under the pointer. The hanger ignores the pointer
  // (the capes overlap, and each column should answer for its own), so its cape does the noticing.
  &__cape:hover &__hanger--liftable {
    transform: translateY(5px);
  }

  &__level {
    display: block;
    width: 200%;
    margin-top: 28px;
    text-align: center;

    &--goal {
      width: 100%;
    }

    // a small yellow pointer above the level of the current cape
    &--current {
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: -8px;
        left: 50%;
        margin-left: -5px;
        border: 5px solid transparent;
        border-top: 0;
        border-bottom-color: var(--color-stat);
      }
    }
  }

  // The XP a cape gained in the session just tallied, written across the cape (which is twice as
  // wide as its column) the way the game writes an XP drop, and risen off it by `showGains`.
  &__xp-drop {
    position: absolute;
    top: 34px;
    left: 0;
    z-index: 9;
    width: 200%;
    text-align: center;
    pointer-events: none;
  }

  // Phones: two rows of twelve on sixteen columns, the max cape at the end of the second row.
  @media (max-width: 760px) {
    grid-template-columns: repeat(16, minmax(0, 1fr));
    row-gap: 12px;
    padding-left: 0;

    &__gap {
      display: none;
    }

    &__cape {
      &--row-start {
        grid-column-start: 1;
      }

      &--first::before {
        left: -16px;
      }

      // the rail carries on under the columns the overlapping capes spill into
      &--row-end::before {
        right: -400%;
      }

      &--goal {
        grid-row: 2;
        grid-column: 15 / 17;

        &::before {
          right: -16px;
        }
      }
    }

    &__level {
      margin-top: 14px;
    }
  }
}
</style>
