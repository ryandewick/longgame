/**
 * The time, refreshed on an interval, for text that ages ('stats 5 min ago') or counts (a block's
 * clock). It only ticks in the browser, and stops when the component using it goes away.
 */
export function useNow(everyMilliseconds = 1000): Readonly<Ref<number>> {
  const now = ref(Date.now())
  if (import.meta.client) {
    const timer = window.setInterval(() => {
      now.value = Date.now()
    }, everyMilliseconds)
    onScopeDispose(() => window.clearInterval(timer))
  }
  return readonly(now)
}
