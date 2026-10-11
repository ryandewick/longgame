<script setup lang="ts">
import type { Intensity, MethodAudience } from '#shared/types/method'
import { skillName } from '#shared/data/skills'
import { INTENSITY_LABELS } from '#shared/domain/format'

/**
 * The "Suggest a method" form: what the method is, how fast it is, who it works for and the wiki
 * page that backs it up. `useSuggestMethod().open(skill)` shows it with that skill picked, and
 * `open()` with the skill left for the player to choose.
 *
 * It is the browser's own modal dialog, which keeps focus inside while it is open, closes on
 * Escape and hands focus back to whatever had it. A click on the dimmed page behind it closes
 * it. The boxes check themselves the browser's way; what the server refuses is said in the form.
 */
const { isOpen, skill, close, send } = useSuggestMethod()
const toast = useToast()

const INTENSITIES: readonly Intensity[] = ['afk', 'semi', 'active']

const AUDIENCE_OPTIONS: readonly { readonly value: MethodAudience; readonly label: string }[] = [
  { value: 'both', label: 'Mains and ironmen' },
  { value: 'main', label: 'Mains only' },
  { value: 'iron', label: 'Ironmen only' },
]

const dialog = useTemplateRef('dialog')
const titleId = useId()
const introId = useId()

/** The form being filled in. It is kept while the dialog closes, so the boxes do not empty first. */
const draft = ref<SuggestionDraft | null>(null)
const isSending = shallowRef(false)
/** Why the last attempt to send was refused, in the server's words. */
const refusal = shallowRef('')

watch(isOpen, (open) => {
  if (!open) {
    dialog.value?.close()
    return
  }
  // every opening is a fresh form: a suggestion half written for another method is not this one
  draft.value = blankSuggestion(skill.value)
  refusal.value = ''
  // the dialog element is rendered once there is a form to show
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal()
  })
})

/** Escape closes the dialog by itself; the composable still has to hear of it. */
function onClose(): void {
  if (isOpen.value) close()
}

// A click counts as on the backdrop only when it was pressed there too. Dragging to select the
// text in a box and letting go outside the form also ends on the dialog, and must not close it.
let pressedOnBackdrop = false

function onPointerDown(event: PointerEvent): void {
  pressedOnBackdrop = event.target === dialog.value
}

/** The dialog's padding is on its form, so a click that lands on the dialog itself is on the backdrop. */
function onClick(event: MouseEvent): void {
  if (pressedOnBackdrop && event.target === dialog.value) close()
}

async function submit(): Promise<void> {
  const sending = draft.value
  if (!sending || isSending.value) return
  isSending.value = true
  refusal.value = ''
  const problem = await send(sending)
  isSending.value = false

  // the form this answer belongs to is still the one on screen, unless it was closed meanwhile
  const stillOpen = isOpen.value && draft.value === sending
  if (!problem) {
    if (stillOpen) close()
    toast.show('Sent. Thank you, it will be checked against the wiki.')
  } else if (stillOpen) {
    refusal.value = problem
  } else {
    toast.show(problem)
  }
}
</script>

<template>
  <dialog
    v-if="draft"
    ref="dialog"
    class="suggest-method-dialog"
    :aria-labelledby="titleId"
    :aria-describedby="introId"
    @close="onClose"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <form class="suggest-method-dialog__form" @submit.prevent="submit">
      <h2 :id="titleId" class="suggest-method-dialog__title">Suggest a method</h2>
      <p :id="introId" class="suggest-method-dialog__intro">
        Know a good method that is missing? Send it and it will be checked against the wiki before
        it is added.
      </p>

      <div class="suggest-method-dialog__pair">
        <label class="field">
          <span class="field__label">Skill</span>
          <select v-model="draft.skill" class="input input--wide" name="skill" required>
            <option v-if="!draft.skill" value="" disabled>Choose a skill</option>
            <option
              v-for="suggestable in SUGGESTABLE_SKILLS"
              :key="suggestable"
              :value="suggestable"
            >
              {{ skillName(suggestable) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Level needed</span>
          <input
            v-model.number="draft.level"
            class="input input--wide"
            name="level"
            type="number"
            min="1"
            max="99"
            required
          />
        </label>
      </div>

      <label class="field">
        <span class="field__label">Method</span>
        <input
          v-model="draft.name"
          class="input input--wide"
          name="name"
          maxlength="80"
          required
          autofocus
          placeholder="What you do, in a few words"
        />
      </label>

      <div class="suggest-method-dialog__pair">
        <label class="field">
          <span class="field__label">XP an hour, if you know it</span>
          <input
            v-model.number="draft.xpPerHour"
            class="input input--wide"
            name="xpPerHour"
            type="number"
            min="0"
            max="2000000"
            step="500"
          />
        </label>
        <label class="field">
          <span class="field__label">Attention</span>
          <select v-model="draft.intensity" class="input input--wide" name="intensity">
            <option v-for="intensity in INTENSITIES" :key="intensity" :value="intensity">
              {{ INTENSITY_LABELS[intensity] }}
            </option>
          </select>
        </label>
      </div>

      <label class="field">
        <span class="field__label">Works for</span>
        <select v-model="draft.audience" class="input input--wide" name="audience">
          <option v-for="option in AUDIENCE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">Wiki page that backs it up</span>
        <input
          v-model="draft.wiki"
          class="input input--wide"
          name="wiki"
          type="url"
          required
          :pattern="SUGGESTION_WIKI_PATTERN"
          placeholder="https://oldschool.runescape.wiki/w/..."
        />
        <span class="field__help">
          A link to the method or training guide on the Old School RuneScape Wiki.
        </span>
      </label>

      <label class="field">
        <span class="field__label">Anything else</span>
        <textarea
          v-model="draft.notes"
          class="input input--wide input--multiline"
          name="notes"
          maxlength="600"
          rows="3"
          placeholder="Quests, gear, where it is, why it is good"
        />
      </label>

      <!-- the honeypot: out of sight and out of the tab order, so only a bot fills it in -->
      <input
        v-model="draft.website"
        class="visually-hidden"
        name="website"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
      />

      <p v-if="refusal" class="suggest-method-dialog__refusal" role="alert">{{ refusal }}</p>

      <div class="action-row action-row--end suggest-method-dialog__actions">
        <button type="button" class="button" @click="close">Cancel</button>
        <button type="submit" class="button button--primary" :disabled="isSending">
          {{ isSending ? 'Sending…' : 'Send suggestion' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style lang="scss">
.suggest-method-dialog {
  width: 100%;
  // a little air between the sheet and the edges of a small window
  max-width: min(600px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: var(--color-panel);
  box-shadow:
    0 0 0 1px var(--color-edge-strong),
    var(--shadow-dialog);
  color: var(--color-text);

  &::backdrop {
    background: var(--color-scrim);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 26px 30px;
  }

  &__title {
    font-size: 24px;
    line-height: 1.05;
  }

  &__intro {
    color: var(--color-text-muted);
  }

  // two short boxes side by side; one under the other on a phone
  &__pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;

    @media (max-width: 760px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__refusal {
    color: var(--color-warning);
    font-weight: 600;
  }

  &__actions {
    margin-top: 8px;
  }
}
</style>
