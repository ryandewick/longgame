<script setup lang="ts">
import {
  migrateLegacySnapshots,
  readSave,
  type LegacySnapshot,
  type SavedState,
} from '#shared/domain/save'

/**
 * Development tooling, to be deleted together with legacy/: loads one of the reference saves the
 * reference screenshots were taken with, so a screen can be checked against its screenshot.
 *
 *   /dev/load?save=live-session            loads legacy/reference/save.live-session.json, opens /
 *   /dev/load?save=no-session&to=/skills   loads another, opens /skills
 *
 * The save goes through the same migration as a real visitor's old save, into the stores (from
 * where it is saved like any other change), and then the app carries on to the page asked for.
 * This page is only a route in `nuxt dev`: see `$development` in nuxt.config.ts.
 */

/** A reference file: a version 1 save and the XP snapshots that go with it. */
interface ReferenceSave {
  state: unknown
  snapshots: LegacySnapshot[]
}

// Found when the page is built, so a checkout without legacy/reference simply has none to offer.
const referenceSaves = import.meta.glob<ReferenceSave>('~~/legacy/reference/save.*.json', {
  import: 'default',
})

const route = useRoute()
const ready = useSaveReady()
const history = useHistoryStore()
const { restore } = useSavedState()

const available = Object.keys(referenceSaves)
  .map((path) => /save\.(.+)\.json$/.exec(path)?.[1])
  .filter((name) => name !== undefined)
const problem = ref('')

async function load(): Promise<void> {
  const name = String(route.query.save ?? '')
  const loader = Object.entries(referenceSaves).find(([path]) =>
    path.endsWith(`/save.${name}.json`),
  )?.[1]
  if (!loader) {
    problem.value = `No reference save called "${name}". There are: ${available.join(', ') || 'none'}.`
    return
  }
  const reference = await loader()
  const save: SavedState | null = readSave(reference.state)
  if (!save) {
    problem.value = `save.${name}.json does not hold a save this app can read.`
    return
  }
  restore(save)
  history.setSnapshots(migrateLegacySnapshots(reference.snapshots))
  const destination = String(route.query.to ?? '/')
  // only ever a path inside the app
  const isOwnPath = destination.startsWith('/') && !destination.startsWith('//')
  await navigateTo(isOwnPath ? destination : '/', { replace: true })
}

// the save in storage is loaded first; loading the reference before it would be overwritten
watch(
  ready,
  (isReady) => {
    if (isReady) void load()
  },
  { immediate: true },
)
</script>

<template>
  <main class="page-width">
    <p class="note note--lead">{{ problem || 'Loading the reference save…' }}</p>
  </main>
</template>
