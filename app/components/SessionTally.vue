<script setup lang="ts">
import type { Session } from '#shared/types/session'
import { skillName } from '#shared/data/skills'
import { formatShortNumber } from '#shared/domain/format'
import type { MotionTimeline } from '~/composables/useMotion'

/**
 * What the last session brought in: the total, the time on the clock, any levels gained, and
 * each skill's share. The hiscores only move when the player logs out, so a tally can come up
 * empty; it then says where the gains will turn up.
 *
 * As a session is tallied (see useMotion) the figures count up from nothing and the rows slide
 * in. Shown at any other time, it simply says what was gained.
 */
const { session } = defineProps<{
  /** A finished session. */
  session: Session
}>()

const totalXp = computed(() => session.tally?.totalXp ?? 0)

/**
 * While the figures count up: how much of each is showing so far, 0 to 1, the total first and
 * then each row. Null the rest of the time, when every figure is simply itself.
 */
const countedShares = shallowRef<readonly number[] | null>(null)
const countedTotalXp = computed(() => totalXp.value * (countedShares.value?.[0] ?? 1))
const gains = computed(() =>
  tallyLines(session).map((gain, row) => ({
    ...gain,
    countedXp: gain.xp * (countedShares.value?.[row + 1] ?? 1),
  })),
)

const total = useTemplateRef('total')
const rowList = useTemplateRef('rowList')
const motion = useMotion()
/** The count, kept so that a second tally would start it again rather than run beside it. */
let counting: MotionTimeline | null = null

motion.onMoment('tally', () => {
  // an empty tally has no figures to count and no rows to bring in
  if (totalXp.value <= 0) return
  motion.play((tweens) => {
    counting?.kill()
    const figures = [totalXp.value, ...gains.value].map(() => ({ share: 0 }))
    const show = (): void => {
      countedShares.value = figures.map((figure) => figure.share)
    }
    // The total keeps exactly the room its final figure takes (which it is still showing, this
    // once), so the words after it stay where they are while other figures count up beside them.
    const heldOpen = total.value
    if (heldOpen) {
      tweens.set(heldOpen, { clearProps: 'display,width' })
      const { width } = heldOpen.getBoundingClientRect()
      tweens.set(heldOpen, { display: 'inline-block', width })
    }
    show()
    counting = tweens
      .timeline({
        onUpdate: show,
        onComplete: () => {
          countedShares.value = null
          if (heldOpen) tweens.set(heldOpen, { clearProps: 'display,width' })
        },
      })
      .to(figures, { share: 1, duration: 0.9, stagger: 0.06, ease: 'power2.out' })
  })
  motion.arrive(
    rowList.value?.rowElements(),
    { x: -12, autoAlpha: 0 },
    { duration: 0.3, stagger: 0.06, ease: 'power2.out' },
  )
})
</script>

<template>
  <section class="session-tally">
    <div class="section-heading">
      <h3 class="section-heading__title">
        <template v-if="totalXp > 0">
          <span ref="total">
            <GameNumber>+{{ formatShortNumber(countedTotalXp) }}</GameNumber>
          </span>
          xp last session
        </template>
        <template v-else>No XP on the hiscores yet</template>
      </h3>
      <span class="section-heading__aside">{{ tallySummary(session) }}</span>
    </div>

    <RowList v-if="gains.length" ref="rowList" :items="gains" :item-key="(gain) => gain.skill">
      <template #lead="{ item: gain }">
        <SkillIcon :skill="gain.skill" />
      </template>
      <template #default="{ item: gain }">{{ skillName(gain.skill) }}</template>
      <template #trail="{ item: gain }">
        <GameNumber>+{{ formatShortNumber(gain.countedXp) }}</GameNumber>
      </template>
    </RowList>
    <p v-else class="note session-tally__waiting">
      Hiscores update when you log out. Refresh in a minute and the gains will land in History.
    </p>
  </section>
</template>

<style lang="scss">
.session-tally {
  &__waiting {
    margin-top: 8px;
  }
}
</style>
