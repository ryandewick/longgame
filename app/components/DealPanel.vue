<script setup lang="ts">
import type { Mood } from '#shared/types/session'
import type { QuestStepPick } from '#shared/domain/quest-step'

/**
 * Where a session starts: how long the player has and what they are up for, then the button
 * that deals. The two choices are the player's preferences, kept from one visit to the next, and
 * the line beside the button says what the deal will be made of.
 */
const { questStep } = defineProps<{
  /** The quest or diary step the deal will end on, which Tonight works out; null for none. */
  questStep: QuestStepPick | null
}>()

const emit = defineEmits<{
  deal: []
}>()

const account = useAccountStore()

const minutes = computed({
  get: () => account.preferences.minutes,
  set: (chosen: number) => account.setPreference('minutes', chosen),
})

const mood = computed({
  get: () => account.preferences.mood,
  set: (chosen: Mood) => account.setPreference('mood', chosen),
})

const lengthOptions = SESSION_LENGTHS.map((length) => ({
  value: length,
  label: sessionLengthLabel(length),
}))

/** The skills this mood could deal. Working it out walks every skill's methods, so it is done once. */
const dealableSkills = computed(() => skillsForMood(account.account, mood.value))
const fannedCapes = computed(() => capesToFan(account.account, dealableSkills.value))

const summary = computed(() =>
  dealSummary({
    skillCount: dealableSkills.value.length,
    mood: mood.value,
    minutes: minutes.value,
    includeResets: account.preferences.includeResets,
    includeWildcard: account.preferences.includeWildcard,
    includeQuestStep: account.preferences.includeQuestStep,
    questStep,
  }),
)
</script>

<template>
  <CapePanel
    :skill="null"
    title="Tonight"
    note="Deal a session built from your levels, your quests and what you did last time."
  >
    <template #swatch>
      <CapeFan :skills="fannedCapes" />
    </template>

    <div class="deal-panel__fields">
      <div class="field">
        <span class="field__label">Time</span>
        <ChipGroup v-model="minutes" label="Time" :options="lengthOptions" />
      </div>
      <div class="field">
        <span class="field__label">Mood</span>
        <ChipGroup v-model="mood" label="Mood" :options="MOOD_OPTIONS" />
        <span class="field__help">{{ moodHelp(mood) }}</span>
      </div>
    </div>

    <template #actions>
      <button type="button" class="button button--primary" @click="emit('deal')">
        Deal tonight’s session
      </button>
      <span class="note">{{ summary }}</span>
    </template>
  </CapePanel>
</template>

<style lang="scss">
.deal-panel {
  &__fields {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 36px;
    margin-top: 16px;
  }
}
</style>
