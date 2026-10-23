<script setup lang="ts">
import { isIronman } from '#shared/domain/account'
import { skillName } from '#shared/data/skills'
import { suggestions } from '#shared/domain/suggestions'

/**
 * The Next part of the Quests page: what to do now and why. The quests that save the most
 * training time for the time they take, the unlocks in the order the account's own Optimal quest
 * guide reaches them (decision 7), and the diary tiers it can claim (decision 6). Every row has a
 * button that marks its quest or tier, which a suggestion only ever moves on.
 */
const account = useAccountStore()
const { markQuest, markDiary } = useQuestToggle()

/** How many rows each quest list shows. */
const MOST_SAVING = 6
const MOST_OPENS = 5

const next = computed(() => suggestions(account.account))
const saving = computed(() => savingRows(next.value.savingHours.slice(0, MOST_SAVING)))
const opens = computed(() => opensRows(next.value.unlocks.slice(0, MOST_OPENS)))
const tiers = computed(() => tierRows(next.value.tiers))
const guideName = computed(() => (isIronman(account.account) ? 'ironman' : 'main'))

const questIcon = questListIconUrl('quest')
const diaryIcon = questListIconUrl('diary')
</script>

<template>
  <div class="quest-next">
    <div>
      <section class="quest-next__group">
        <div class="section-heading section-heading--first">
          <h2 class="section-heading__title">Saves you training time</h2>
          <span class="section-heading__aside">biggest saving for the time first</span>
        </div>
        <p class="note quest-next__lead">
          Each takes hours off your time to max. The time is at an ordinary pace and includes the
          quests that have to come first.
        </p>
        <div v-if="saving.length" class="data-table__scroller">
          <table class="data-table quest-next__table">
            <thead>
              <tr>
                <th class="data-table__heading" scope="col">
                  <span class="visually-hidden">Kind</span>
                </th>
                <th class="data-table__heading" scope="col">Quest</th>
                <th class="data-table__heading data-table__heading--number" scope="col">Saves</th>
                <th class="data-table__heading data-table__heading--number" scope="col">Takes</th>
                <th class="data-table__heading quest-next__action-heading" scope="col">
                  <span class="visually-hidden">Mark done</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in saving"
                :key="row.name"
                class="data-table__row"
                :class="{ 'data-table__row--banded': index % 2 === 1 }"
              >
                <td class="data-table__cell data-table__cell--top data-table__cell--icon">
                  <img class="quest-next__icon" :src="questIcon" alt="" />
                </td>
                <td class="data-table__cell data-table__cell--top">
                  <b class="data-table__title">{{ row.name }}</b>
                  <span v-if="row.skills.length" class="quest-next__skills">
                    <SkillIcon
                      v-for="skill in row.skills"
                      :key="skill"
                      :skill="skill"
                      :title="skillName(skill)"
                    />
                  </span>
                  <span v-if="row.gives" class="data-table__detail">{{ row.gives }}</span>
                  <span v-if="row.advice" class="data-table__detail">{{ row.advice }}</span>
                  <span v-if="row.boost" class="data-table__detail">{{ row.boost }}</span>
                  <span v-if="row.first" class="data-table__detail quest-next__first">
                    {{ row.first }}
                  </span>
                </td>
                <td class="data-table__cell data-table__cell--top data-table__cell--number">
                  <span class="quest-next__figure">
                    <GameNumber>{{ row.saves.figure }}</GameNumber>
                    <GameNumber tone="white">{{ row.saves.unit }}</GameNumber>
                  </span>
                </td>
                <td class="data-table__cell data-table__cell--top data-table__cell--number">
                  <GameNumber tone="white">{{ row.takes }}</GameNumber>
                </td>
                <td class="data-table__cell data-table__cell--top data-table__cell--actions">
                  <button
                    type="button"
                    class="button button--small"
                    :aria-label="row.action.ariaLabel"
                    @click="markQuest(row.name, 'finished')"
                  >
                    {{ row.action.label }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="note">
          Nothing you are ready for takes half an hour or more off your time right now.
        </p>
      </section>

      <section class="quest-next__group">
        <div class="section-heading">
          <h2 class="section-heading__title">Opens the game</h2>
          <span class="section-heading__aside">in your quest guide’s order</span>
        </div>
        <p class="note quest-next__lead">
          No hours off, but each one opens something big, in the order the {{ guideName }} quest
          guide does them.
        </p>
        <div v-if="opens.length" class="data-table__scroller">
          <table class="data-table quest-next__table">
            <thead>
              <tr>
                <th class="data-table__heading" scope="col">
                  <span class="visually-hidden">Kind</span>
                </th>
                <th class="data-table__heading" scope="col">Quest</th>
                <th class="data-table__heading data-table__heading--number" scope="col">
                  Guide step
                </th>
                <th class="data-table__heading data-table__heading--number" scope="col">Takes</th>
                <th class="data-table__heading quest-next__action-heading" scope="col">
                  <span class="visually-hidden">Mark done or started</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in opens"
                :key="row.goal"
                class="data-table__row"
                :class="{ 'data-table__row--banded': index % 2 === 1 }"
              >
                <td class="data-table__cell data-table__cell--top data-table__cell--icon">
                  <img class="quest-next__icon" :src="questIcon" alt="" />
                </td>
                <td class="data-table__cell data-table__cell--top">
                  <b class="data-table__title">{{ row.name }}</b>
                  <span class="data-table__detail">{{ row.about }}</span>
                  <span v-if="row.warning" class="data-table__detail">
                    <em class="data-table__needs">{{ row.warning }}</em>
                  </span>
                </td>
                <td class="data-table__cell data-table__cell--top data-table__cell--number">
                  <span class="quest-next__step">{{ row.step }}</span>
                </td>
                <td class="data-table__cell data-table__cell--top data-table__cell--number">
                  <GameNumber v-if="row.takes" tone="white">{{ row.takes }}</GameNumber>
                </td>
                <td class="data-table__cell data-table__cell--top data-table__cell--actions">
                  <button
                    type="button"
                    class="button button--small"
                    :aria-label="row.action.ariaLabel"
                    @click="markQuest(row.name, row.state)"
                  >
                    {{ row.action.label }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="note">Every unlock your quest guide reaches is done.</p>
      </section>
    </div>

    <section class="quest-next__group">
      <div class="section-heading section-heading--first">
        <h2 class="section-heading__title">Diary tiers you can claim</h2>
        <span class="section-heading__aside">lower tiers first</span>
      </div>
      <p class="note quest-next__lead">
        Every tier here is ready now. The tick list says what the others still need. The time is for
        the tasks.
      </p>
      <div v-if="tiers.length" class="data-table__scroller">
        <table class="data-table quest-next__table">
          <thead>
            <tr>
              <th class="data-table__heading" scope="col">
                <span class="visually-hidden">Kind</span>
              </th>
              <th class="data-table__heading" scope="col">Tier</th>
              <th class="data-table__heading data-table__heading--number" scope="col">Takes</th>
              <th class="data-table__heading quest-next__action-heading" scope="col">
                <span class="visually-hidden">Mark done</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in tiers"
              :key="row.name"
              class="data-table__row"
              :class="{ 'data-table__row--banded': index % 2 === 1 }"
            >
              <td class="data-table__cell data-table__cell--top data-table__cell--icon">
                <img class="quest-next__icon" :src="diaryIcon" alt="" />
              </td>
              <td class="data-table__cell data-table__cell--top">
                <b class="data-table__title">{{ row.name }}</b>
                <span v-if="row.reward" class="data-table__detail">{{ row.reward }}</span>
                <span v-if="row.boost" class="data-table__detail">{{ row.boost }}</span>
                <span v-if="row.longTask" class="data-table__detail">{{ row.longTask }}</span>
              </td>
              <td class="data-table__cell data-table__cell--top data-table__cell--number">
                <GameNumber tone="white">{{ row.takes }}</GameNumber>
              </td>
              <td class="data-table__cell data-table__cell--top data-table__cell--actions">
                <button
                  type="button"
                  class="button button--small"
                  :aria-label="row.action.ariaLabel"
                  @click="markDiary(row.name)"
                >
                  {{ row.action.label }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="note">
        No tier is ready to claim yet. The tick list says what each diary’s next tier needs.
      </p>
    </section>
  </div>
</template>

<style lang="scss">
.quest-next {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 480px;
  align-items: start;
  gap: 48px;

  &__lead {
    margin-bottom: 10px;
  }

  &__group + &__group {
    margin-top: 34px;
  }

  // the game's own quest and diary icons, at their 21 pixels
  &__icon {
    display: block;
    width: 21px;
    height: 21px;
    image-rendering: pixelated;
  }

  &__skills {
    display: flex;
    gap: 2px;
    margin: 4px 0 1px;
  }

  // the quests to do first: the one line of a saving row in bone, since it changes what to do
  &__first {
    color: var(--color-text);
  }

  &__figure {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  &__step {
    color: var(--color-text-muted);
    font-weight: 600;
    font-variant-numeric: tabular-nums lining-nums;
  }

  &__action-heading {
    width: 1%;
  }

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
</style>
