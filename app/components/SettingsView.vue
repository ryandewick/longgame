<script setup lang="ts">
import type { AccountType, Budget } from '#shared/types/account'
import type { SkillKey } from '#shared/types/skill'
import { SKILLS } from '#shared/data/skills'

/**
 * Settings: the open account, how it likes to train, and exporting, importing or forgetting it.
 * Every field here is the open account's own: each account keeps its own settings.
 */
const account = useAccountStore()
const history = useHistoryStore()
const list = useAccountListStore()
const mode = useAppMode()
const toast = useToast()
const { confirm } = useConfirm()
const { isRefreshing, rename, forgetOpen, importAccount } = useAccounts()
const { savedState } = useSavedState()

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
// the field follows the open account: another can be opened from the top bar while this page is up
watch(
  () => account.name,
  (current) => {
    name.value = current
  },
)

/** The same account under a new name, as after a name change in the game: nothing else changes. */
async function changeName(): Promise<void> {
  await rename(name.value)
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
    ? 'Every account is saved to the .data folder inside the project. Copy that folder to back them all up, or export an account to load here or on the website.'
    : 'Every account is saved in this browser only. Clearing your site data removes them all, so export any account that matters to you.'

function exportData(): void {
  const file = buildExportFile(savedState.value, history.snapshots)
  downloadFile(
    new Blob([JSON.stringify(file)], { type: 'application/json' }),
    accountFileName(account.name, 'json'),
  )
}

/**
 * Loads an account from a file made by Export, once the player agrees: beside the others, or in
 * the place of the saved account with the same name.
 */
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
  const imported = backup.save.name
  const saved = list.savedName(imported)
  const agreed = await confirm(
    saved === null
      ? {
          title: `Import ${imported}`,
          body: `This adds ${imported} from the file. Your other accounts stay as they are.`,
          confirmLabel: 'Import',
        }
      : {
          title: `Replace ${saved}`,
          body: `This puts the file’s ${imported} in place of the one saved here: its stats, ticks, sessions and settings. Its XP history is merged with the file’s, so none of it is lost.`,
          confirmLabel: 'Replace',
        },
  )
  if (!agreed) return
  await importAccount(backup)
  toast.show(`Imported ${imported}.`)
}

async function forgetAccount(): Promise<void> {
  const forgotten = account.name
  const kept = mode === 'local' ? 'on disk' : 'in this browser'
  const agreed = await confirm({
    title: `Forget ${forgotten}`,
    body: `Its stats, sessions, ticks and settings go. Its XP history stays ${kept}, so adding ${forgotten} again picks it up.`,
    confirmLabel: 'Forget',
  })
  if (!agreed) return
  await forgetOpen()
  toast.show(`Forgot ${forgotten}.`)
}
</script>

<template>
  <div class="settings-view">
    <div class="section-heading section-heading--first">
      <h1 class="section-heading__title section-heading__title--page">Settings</h1>
    </div>
    <p class="settings-view__lead">
      These are {{ account.name }}’s settings. Each account keeps its own.
    </p>

    <div class="settings-view__fields">
      <form class="field" @submit.prevent="changeName">
        <label class="field__label" :for="nameFieldId">Name</label>
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
        <span class="field__help">
          Changed your name in the game? Type the new one and this account keeps everything. To plan
          for a different account, add it from the menu under your name.
        </span>
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
          <button type="button" class="button" @click="exportData">Export this account</button>
          <button type="button" class="button" @click="fileInput?.click()">
            Import an account
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            hidden
            @change="importFile"
          />
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
  // whose settings these are, between the heading and the first field
  &__lead {
    max-width: 72ch;
    margin: -8px 0 26px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  // one column of fields, no wider than its longest help text reads well
  &__fields {
    display: flex;
    flex-direction: column;
    gap: 30px;
    max-width: 780px;
  }
}
</style>
