<script setup lang="ts">
import type { SkillKey } from '#shared/types/skill'
import { buildGuideLinks } from '#shared/domain/guides'
import { HOME_DESCRIPTION, HOME_TITLE, QUESTIONS } from '#shared/domain/site'

/**
 * What the website's home page says below the setup screen to someone who has never used the
 * planner: what it is, what it does, where the training guides are and the questions people
 * ask. It is also what a search engine reads, so it sets the home page's title, description,
 * link preview and structured data, all of which go again once an account is loaded and the
 * page becomes that player's Tonight.
 *
 * It is a long way down the page, so its blocks (each feature, the guide links, the questions)
 * ease in as they are scrolled to: see useReveal.
 */
interface Feature {
  readonly title: string
  readonly text: string
  /** The cape beside the feature; null for the max cape. */
  readonly cape: SkillKey | null
  /** How much of that cape is in colour, 0 to 100. */
  readonly fill: number
}

const FEATURES: readonly Feature[] = [
  {
    cape: null,
    fill: 68,
    title: 'See the whole grind at once',
    text: 'Every skill is a cape that fills with colour as you level. You see the levels left, the hours left at the best methods open to you, and which capes are closest.',
  },
  {
    cape: 'woodcutting',
    fill: 76,
    title: 'Get tonight’s session dealt for you',
    text: 'Say how long you have and how much attention you can spare. Long Game deals a session of timed blocks from AFK, semi-AFK or active methods your account has actually unlocked, plus any farm or birdhouse runs that are due.',
  },
  {
    cape: 'smithing',
    fill: 61,
    title: 'Built for mains and ironmen',
    text: 'It tells a main from an ironman from the hiscores and plans accordingly. Ironmen get the wiki’s ironman routes, with no method that needs the Grand Exchange.',
  },
  {
    cape: 'firemaking',
    fill: 87,
    title: 'Track what you gained',
    text: 'Finish a session and it tallies the XP from the hiscores, keeps a 14-day history and counts your streak. Everything is saved in your own browser.',
  },
]

const guideLinks = buildGuideLinks()
const vReveal = useReveal()
const { siteUrl } = useRuntimeConfig().public

usePageSeo({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: '/',
  structuredData: buildHomeStructuredData(siteUrl),
})
</script>

<template>
  <div class="landing-sections">
    <section>
      <h2 class="landing-sections__heading">Log in knowing what to do</h2>
      <p class="landing-sections__lead">
        You log in, stand at the bank, and log off again. Not because there is nothing to do, but
        because deciding is the hard part. Long Game decides before you log in. Type your display
        name and it reads your levels from the official hiscores, hangs all 24 skillcapes on one
        rail, and deals you tonight’s session from what your account can actually do.
      </p>
      <div class="landing-sections__features">
        <LandingFeature
          v-for="feature in FEATURES"
          :key="feature.title"
          :title="feature.title"
          :text="feature.text"
          :cape="feature.cape"
          :fill="feature.fill"
        />
      </div>
    </section>
    <section class="landing-sections__section">
      <h2 class="landing-sections__heading">Training methods for every skill</h2>
      <GuideLinks v-reveal :links="guideLinks" />
    </section>
    <section class="landing-sections__section">
      <h2 class="landing-sections__heading">Questions</h2>
      <FaqList v-reveal :questions="QUESTIONS" />
    </section>
  </div>
</template>

<style lang="scss">
.landing-sections {
  &__section {
    margin-top: 44px;
  }

  &__heading {
    margin-bottom: 12px;
    font-size: 26px;
    line-height: 1.1;
  }

  &__lead {
    max-width: 68ch;
    color: var(--color-text);
    font-size: 17px;
  }

  &__features {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 26px 48px;
    margin-top: 26px;
  }

  @media (max-width: 760px) {
    &__features {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
