<script setup lang="ts">
/**
 * Resets: the timed runs, dailies and weeklies open to the account's type, when each is next
 * due, and a button to log one as done.
 */
const account = useAccountStore()
const toast = useToast()

// "ready in 12 min" counts down by itself, half a minute at most behind the clock
const now = useNow(30_000)

const rows = computed(() => resetsTableRows(account.account, account.resetLog, now.value))

function markDone(resetKey: string): void {
  account.markResetDone(resetKey)
  toast.show('Logged. The timer restarts now.')
}
</script>

<template>
  <div class="resets-view">
    <div class="section-heading section-heading--first">
      <h1 class="section-heading__title section-heading__title--page">Resets</h1>
      <span class="section-heading__aside">
        Passive XP on a timer. Tick them as you do them and the session builder slots them in when
        they are due.
      </span>
    </div>
    <ResetsTable :rows="rows" @done="markDone" />
  </div>
</template>
