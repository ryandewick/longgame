<script setup lang="ts">
/**
 * The resets the account can do, the due ones first: each says "Due" with a button to log it
 * as done, or how long until it comes round. Five at most, with the way to the rest.
 */
const account = useAccountStore()
const toast = useToast()

/** The list shows this many; the Resets page has them all. */
const MOST_RESETS_LISTED = 5

// "in 34 min" only needs to move once a minute
const now = useNow(60_000)

const rows = computed(() => {
  // a reset logged since the last tick is timed from when it was logged, not from before it
  const lastLogged = Math.max(0, ...Object.values(account.resetLog))
  return resetsDueFirst(account.account, account.resetLog, Math.max(now.value, lastLogged))
})

const listed = computed(() => rows.value.slice(0, MOST_RESETS_LISTED))

function markDone(resetKey: string): void {
  account.markResetDone(resetKey)
  toast.show('Logged. The timer restarts now.')
}
</script>

<template>
  <section class="resets-panel">
    <div class="section-heading section-heading--first">
      <h3 class="section-heading__title">Resets</h3>
      <span v-if="rows.length" class="section-heading__aside">{{ dueCountLabel(rows) }}</span>
    </div>

    <template v-if="rows.length">
      <RowList :items="listed" :item-key="(row) => row.reset.key">
        <template #lead="{ item: row }">
          <SkillIcon :skill="row.reset.skill" />
        </template>
        <template #default="{ item: row }">{{ row.reset.name }}</template>
        <template #trail="{ item: row }">
          <template v-if="row.status.due">
            <GameNumber tone="due">Due</GameNumber>
            <button
              type="button"
              class="button button--small button--ghost resets-panel__done"
              :aria-label="`Done: ${row.reset.name}`"
              @click="markDone(row.reset.key)"
            >
              Done
            </button>
          </template>
          <span v-else class="resets-panel__wait">
            {{ resetWaitLabel(row.status.readyInMilliseconds) }}
          </span>
        </template>
      </RowList>
      <p v-if="rows.length > MOST_RESETS_LISTED" class="note resets-panel__more">
        <NuxtLink to="/resets">All {{ rows.length }} resets</NuxtLink>
      </p>
    </template>
    <p v-else class="note resets-panel__more">
      Nothing unlocked yet. The Resets view lists what each one needs.
    </p>
  </section>
</template>

<style lang="scss">
.resets-panel {
  // the button's text, not its padding, lines up with the column's edge and sits close to "Due"
  &__done {
    margin-right: -8px;
    margin-left: -4px;
  }

  &__wait {
    color: var(--color-text-faint);
    font-size: 13px;
    white-space: nowrap;
  }

  &__more {
    margin-top: 8px;
  }
}
</style>
