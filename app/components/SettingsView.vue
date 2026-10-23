<script setup lang="ts">
import type { AccountType, Budget } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { SKILLS } from '#shared/data/skills'

/**
 * Settings: the account, how it likes to train, and exporting, importing or forgetting what is
 * saved.
 */
const account = useAccountStore()
const history = useHistoryStore()
const mode = useAppMode()
const toast = useToast()
const { confirm } = useConfirm()
const { isRefreshing, loadAccount } = useStatsRefresh()
const { savedState, restore } = useSavedState()
// the storage comes from a plugin that only runs in the browser, so it is looked up when a file
// is imported (always in the browser) rather than here
const nuxtApp = useNuxtApp()

const ACCOUNT_TYPES: readonly { readonly value: AccountType; readonly label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'iron', label: 'Ironman' },
]

const BUDGETS: readonly { readonly value: Budget; readonly label: string }[] = [
  { value: 'any', label: 'Spend what it takes' },
  { value: 'cheap', label: 'Cheap methods only' },
]

/** The switches for how sessions are dealt, each a preference that is on or off. */
const SESSION_SWITCHES = [
  { preference: 'includeResets', label: 'Slot in due resets' },
  { preference: 'includeWildcard', label: 'One wildcard per session' },
  { preference: 'includeQuestStep', label: 'One quest or diary step per session' },
  { preference: 'tickPerfect', label: 'Tick-perfect methods' },
] as const

type SessionSwitch = (typeof SESSION_SWITCHES)[number]['preference']

/** A passive skill (Hitpoints) is never dealt, so there is nothing to leave out. */
const DEALT_SKILLS = SKILLS.filter((skill) => !skill.passive)

const nameFieldId = useId()
const sessionsLabelId = useId()
const skillsLabelId = useId()
const fileInput = useTemplateRef('fileInput')

const name = ref(account.name)

/** A different name is a different account: its stats are fetched and the planner starts over on Tonight. */
async function changeName(): Promise<void> {
  if (await loadAccount(name.value)) await navigateTo('/')
}

// until the lookup has said, an account is planned as a main
const accountType = computed<AccountType>({
  get: () => account.accountType ?? 'main',
  set: (type) => account.setAccountType(type),
})

const budget = computed<Budget>({
  get: () => account.preferences.budget,
  set: (chosen) => account.setPreference('budget', chosen),
})

function toggleSwitch(preference: SessionSwitch): void {
  account.setPreference(preference, !account.preferences[preference])
}

const isExcluded = (skill: SkillKey): boolean => account.preferences.excludedSkills.includes(skill)

const dataHelp =
  mode === 'local'
    ? 'Everything is saved to the .data folder inside the project. Copy that folder to back it up, or export a file you can load on the website.'
    : 'Saved in this browser only. Clearing your site data removes it, so export a copy if it matters to you.'

function exportData(): void {
  const file = buildExportFile(savedState.value, history.snapshots)
  downloadFile(
    new Blob([JSON.stringify(file)], { type: 'application/json' }),
    accountFileName(account.name, 'json'),
  )
}

/** Loads a file made by Export, once the player agrees to it replacing what is saved here. */
async function importFile(): Promise<void> {
  const input = fileInput.value
  const file = input?.files?.[0]
  if (!input || !file) return
  const backup = readExportFile(await file.text())
  // emptied so that choosing the same file again is still a change
  input.value = ''
  if (!backup) {
    toast.show('That file is not a Long Game export.')
    return
  }
  const { save, snapshots } = backup
  const agreed = await confirm({
    title: 'Import this file',
    body: `This replaces what is saved here with ${save.name} from the file.`,
    confirmLabel: 'Import',
  })
  if (!agreed) return

  restore(save)
  history.setSnapshots(snapshots)
  try {
    history.setSnapshots(await nuxtApp.$saveStorage.replaceSnapshots(save.name, snapshots))
  } catch (error) {
    // the stores hold the imported history for this visit; only keeping it failed (storage is full)
    console.warn('Could not keep the imported XP history.', error)
  }
  // a different account's rack is about to be hung: it fills the way a rack does on the first load
  expectFirstLoad()
  await navigateTo('/')
  toast.show(`Imported ${save.name}.`)
}

async function forgetAccount(): Promise<void> {
  const kept =
    mode === 'local' ? 'Snapshots on disk stay.' : 'Your XP history stays in this browser.'
  const agreed = await confirm({
    title: 'Forget this account',
    body: `Stats, sessions and manual ticks go. ${kept}`,
    confirmLabel: 'Forget',
  })
  if (!agreed) return
  account.forget()
  await navigateTo('/')
}
</script>

<template>
  <div class="settings-view">
    <div class="section-heading section-heading--first">
      <h1 class="section-heading__title section-heading__title--page">Settings</h1>
    </div>

    <div class="settings-view__fields">
      <form class="field" @submit.prevent="changeName">
        <label class="field__label" :for="nameFieldId">Account</label>
        <div class="field__row">
          <input
            :id="nameFieldId"
            v-model="name"
            class="input"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="submit" class="button" :disabled="isRefreshing">Change name</button>
        </div>
      </form>

      <div class="field">
        <span class="field__label">Account type</span>
        <ChipGroup v-model="accountType" label="Account type" :options="ACCOUNT_TYPES" />
        <span class="field__help">
          Ironman drops every method that needs the Grand Exchange and uses the wiki’s ironman
          routes instead. It is read from the hiscores when the name loads. Change it here if that
          is wrong.
        </span>
      </div>

      <div v-if="!account.isIronman" class="field">
        <span class="field__label">Budget</span>
        <ChipGroup v-model="budget" label="Budget" :options="BUDGETS" />
        <span class="field__help">Cheap hides the routes marked pricey.</span>
      </div>

      <div class="field">
        <span :id="sessionsLabelId" class="field__label">Sessions</span>
        <div class="chip-group" role="group" :aria-labelledby="sessionsLabelId">
          <ToggleChip
            v-for="option in SESSION_SWITCHES"
            :key="option.preference"
            :pressed="account.preferences[option.preference]"
            @toggle="toggleSwitch(option.preference)"
          >
            {{ option.label }}
          </ToggleChip>
        </div>
        <span class="field__help">
          The wildcard only appears in sessions of 90 minutes or more. A quest or diary step from
          the Quests page’s Next takes its place when one fits in half the session, in sessions of
          an hour or more, and never on an AFK night. Tick-perfect methods (3-tick fishing, 1-tick
          karambwans and the like) are left out of plans and estimates unless you turn them on. They
          rely on tick manipulation, acting on exact game ticks so the skill rolls more often, and
          their rates assume you have practised it. The wiki’s
          <a :href="TICK_MANIPULATION_PAGE" rel="noopener">tick manipulation</a>
          page explains how it works.
        </span>
      </div>

      <div class="field">
        <span :id="skillsLabelId" class="field__label">Skills to leave out</span>
        <div class="chip-group" role="group" :aria-labelledby="skillsLabelId">
          <ToggleChip
            v-for="skill in DEALT_SKILLS"
            :key="skill.key"
            :pressed="isExcluded(skill.key)"
            @toggle="account.setSkillExcluded(skill.key, !isExcluded(skill.key))"
          >
            <SkillIcon :skill="skill.key" size="chip" />
            {{ skill.name }}
          </ToggleChip>
        </div>
        <span class="field__help">
          Click to drop a skill from the session builder. It still shows on the Skills view.
        </span>
      </div>

      <div class="field">
        <span class="field__label">Data</span>
        <span class="field__help">{{ dataHelp }}</span>
        <div class="field__row">
          <button type="button" class="button" @click="exportData">Export my data</button>
          <!-- a local copy is moved by copying its data folder, so only the website imports -->
          <template v-if="mode === 'hosted'">
            <button type="button" class="button" @click="fileInput?.click()">Import a file</button>
            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              hidden
              @change="importFile"
            />
          </template>
          <button type="button" class="button button--danger" @click="forgetAccount">
            Forget this account
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.settings-view {
  // one column of fields, no wider than its longest help text reads well
  &__fields {
    display: flex;
    flex-direction: column;
    gap: 30px;
    max-width: 780px;
  }
}
</style>
