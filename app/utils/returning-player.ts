/*
 * The website's pages are built ahead of time as a first visit: the setup screen and the landing
 * content. A returning player's save is in their browser, which the server never sees, so their
 * page arrives as a first visit too, and the app only puts their planner in its place once it
 * has started. To stop the first-visit screen flashing by in between, a few lines of script in
 * the head look for a saved account before anything is painted and mark the document, and
 * PlannerPage's styles hide the first-visit screen in a marked document.
 *
 * The mark is a guess that covers the moment before the app knows better. PlannerPage takes it
 * off as soon as the save has loaded, and from then on the stores decide what is drawn.
 *
 * This file imports nothing, because nuxt.config.ts reads it too.
 */

/** The class on <html> that says: a saved account was found, so do not show the first-visit screen. */
export const RETURNING_PLAYER_CLASS = 'returning-player'

// The keys utils/save-storage.ts keeps the save under: this app's, then the vanilla app's, which
// is migrated on load. tests/app/returning-player.test.ts checks that the two files agree.
const SAVE_KEY = 'longgame.save'
const LEGACY_SAVE_KEY = 'longgame.state.v1'

/**
 * The script. An account is a name with stats (`hiscores` in this app's save, `hs` in the
 * vanilla app's), the same test as the account store's `hasAccount`. Anything unexpected (no
 * storage, a save that will not parse) leaves the document unmarked, which is a first visit.
 */
export const RETURNING_PLAYER_SCRIPT =
  '(function(){try{' +
  `var s=JSON.parse(localStorage.getItem('${SAVE_KEY}'))||JSON.parse(localStorage.getItem('${LEGACY_SAVE_KEY}'));` +
  `if(s&&s.name&&(s.hiscores||s.hs))document.documentElement.classList.add('${RETURNING_PLAYER_CLASS}')` +
  '}catch(e){}})()'
