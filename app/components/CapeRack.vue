<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { skillName } from '#shared/data/skills'
import { formatNumber, formatShortNumber } from '#shared/domain/format'
import { MAX_LEVEL, xpToNextLevel } from '#shared/domain/xp'
import type { RailCape } from './CapeRail.vue'

/**
 * The rack: the account as one picture. Every skillcape on the rail, lowest level first, each
 * filled as far as its level, under a count of the capes earned and a line saying what is left.
 * After a session with a level gained, the game's level-up dialog sits in the heading row.
 *
 * Clicking a cape opens that skill on the Skills page. "Share my rack" draws the rack as a
 * picture and opens the share dialog (see useShareRack).
 *
 * The rack marks three moments (see useMotion): the capes fill on the first load, the live
 * block's cape comes forward, and at the tally the capes that gained fill to their new levels as
 * the level-up dialog drops in.
 */
const { currentSkill = null } = defineProps<{
  /** The cape to bring forward: the live block's skill on Tonight, the selected skill on Skills. */
  currentSkill?: SkillKey | null
}>()

const account = useAccountStore()
const session = useSessionStore()
const { open: shareRack } = useShareRack()

const capes = computed<RailCape[]>(() =>
  account.rackOrder.map((skill) => {
    const stat = account.account.skills[skill]
    const toNextLevel =
      stat.level >= MAX_LEVEL
        ? ''
        : `, ${formatShortNumber(xpToNextLevel(stat))} xp to ${stat.level + 1}`
    return {
      skill,
      level: stat.level,
      description: `${skillName(skill)} ${stat.level}${toNextLevel}`,
    }
  }),
)

const isMaxed = computed(() => account.maxProgress.skillsMaxed === account.maxProgress.skillCount)

const summary = computed(() => {
  if (isMaxed.value) return 'Maxed. Every cape is on the rail.'
  const { levelsLeft, hoursLeft } = account.maxProgress
  const caveat = account.hasRoughEstimate ? ' (rough where the wiki gives no rate)' : ''
  return `${formatNumber(levelsLeft)} levels to go, about ${formatLongHours(hoursLeft)} at your best methods${caveat}.`
})

/** The first skill that gained a level in the session just finished, and how many more did. */
const levelUp = computed(() => {
  const [skill, ...others] = session.levelledSkills
  if (!skill) return null
  return { skill, level: account.account.skills[skill].level, moreCount: others.length }
})

const rail = useTemplateRef('rail')
const banner = useTemplateRef('banner')
const motion = useMotion()

motion.onMoment('first-load', () => rail.value?.fillFromEmpty())
motion.onMoment('live', () => rail.value?.bringCurrentForward())
motion.onMoment('tally', () => {
  if (session.session) void rail.value?.showGains(capeGains(session.session))
  motion.arrive(
    banner.value,
    { y: -16, autoAlpha: 0 },
    { duration: 0.4, delay: 0.6, ease: 'back.out(1.6)' },
  )
})
</script>

<template>
  <RackStage class="cape-rack" label="Your skillcapes">
    <template #title>
      <GameNumber class="cape-rack__count" size="headline">
        {{ account.maxProgress.skillsMaxed }}/{{ account.maxProgress.skillCount }}
      </GameNumber>
      capes
    </template>

    <p class="cape-rack__summary">{{ summary }}</p>
    <div v-if="levelUp" ref="banner" class="cape-rack__banner">
      <LevelUpBanner
        :skill="levelUp.skill"
        :level="levelUp.level"
        :more-count="levelUp.moreCount"
      />
    </div>
    <button
      type="button"
      class="button button--small cape-rack__share"
      :class="{ 'cape-rack__share--after-banner': levelUp }"
      @click="shareRack"
    >
      Share my rack
    </button>

    <template #rail>
      <CapeRail
        ref="rail"
        :capes="capes"
        :max-cape-fill="account.maxProgress.percent"
        :max-cape-complete="isMaxed"
        :max-cape-description="`${account.maxProgress.percent.toFixed(2)}% of the XP to max`"
        :current-skill="currentSkill"
        interactive
      />
    </template>
  </RackStage>
</template>

<style lang="scss">
.cape-rack {
  // the count is set in the game's bold font, which sits higher on its line than the word beside it
  &__count {
    position: relative;
    top: 3px;
  }

  &__summary {
    color: var(--color-text-muted);
  }

  // the level-up dialog and the share button keep to the right of the heading row
  &__banner {
    margin-left: auto;
  }

  &__share {
    margin-left: auto;

    &--after-banner {
      margin-left: 0;
    }
  }

  // once the row has wrapped there is no right to keep to
  @media (max-width: 1000px) {
    &__banner,
    &__share {
      margin-left: 0;
    }
  }
}
</style>
