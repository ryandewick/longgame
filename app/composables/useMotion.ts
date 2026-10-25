import { gsap } from 'gsap'

/*
 * Motion. GSAP animates a handful of moments and nothing else: the rack filling on the first
 * load, a deal, a block going live, a swap and the tally. (The landing content coming in as it is
 * scrolled to is `useReveal`; a change of page is the browser's own view transition.)
 *
 * Every screen is complete without any of it. A screen is drawn in its final state first, and a
 * tween only ever starts from somewhere else and comes back to that state, clearing the inline
 * styles it set. Nothing runs on the server, and nothing runs for a visitor who has asked for
 * reduced motion: that is checked each time something is about to move.
 *
 * How a moment travels. The stores know nothing about motion. The component whose button caused
 * the change says so with `announceMoment`, in the same tick as the change. Once the page has
 * been drawn again, every component that asked to hear that moment (`useMotion().onMoment`) is
 * told, and moves its own elements. To add a moment: name it in `Moment`, announce it where it
 * happens, and listen for it in the components that own what moves.
 */

/** A moment worth marking, as the component that caused it announces it. */
export type Moment =
  /**
   * The first planner screen of the visit has been drawn. Every planner page announces it and
   * only the first is heard, until `expectFirstLoad` says the planner is starting over.
   */
  | { readonly name: 'first-load' }
  /** A session has been dealt. */
  | { readonly name: 'deal' }
  /** A block has become the one to do now: after a deal, a swap of the live block, or the last one finishing. */
  | { readonly name: 'live' }
  /** The block at this place in the session has been swapped for another skill. */
  | { readonly name: 'swap'; readonly blockIndex: number }
  /** The session has been finished and its gains are in. */
  | { readonly name: 'tally' }

export type MomentName = Moment['name']
type MomentNamed<Name extends MomentName> = Extract<Moment, { name: Name }>

/** When a tween runs: GSAP's own words, in seconds. */
export interface MotionTiming {
  readonly duration: number
  readonly ease: string
  readonly delay?: number
  /** Seconds between one element setting off and the next. */
  readonly stagger?: number
}

/** A tween a component keeps hold of, to finish or stop it later. */
export type MotionTween = gsap.core.Tween
/** A timeline a component keeps hold of, to stop it if its moment comes round again. */
export type MotionTimeline = gsap.core.Timeline

/** What a component may hand over to be moved: its own elements, or none if they are not on the page. */
type Targets = Element | readonly Element[] | null | undefined

/** What `useMotion` hands a component. */
export interface Motion {
  /**
   * Runs `play` each time the moment is announced, once the page has been drawn with whatever
   * the moment changed. Not called under reduced motion.
   */
  onMoment: <Name extends MomentName>(name: Name, play: (moment: MomentNamed<Name>) => void) => void
  /**
   * Brings elements in: each starts displaced as `from` says (GSAP's properties: `y`, `scale`,
   * `autoAlpha`...) and comes to rest where the styles put it, after which its inline styles are
   * cleared. Calling it again for an element still on its way starts that element afresh.
   */
  arrive: (targets: Targets, from: gsap.TweenVars, timing: MotionTiming) => void
  /** Stops elements that `arrive` has on their way and puts them where the styles have them, at once. */
  rest: (targets: Targets) => void
  /**
   * Runs `start` with GSAP, for a tween `arrive` does not cover. Whatever it starts belongs to
   * the component and is stopped when the component goes. Not called under reduced motion.
   */
  play: (start: (tweens: typeof gsap) => void) => void
}

/**
 * What `arrive` may set inline, and so what is cleared afterwards: where an element is, whether
 * it shows, and the CSS transition that is held off while it moves.
 */
const DISPLACED_PROPERTIES = 'transform,transformOrigin,opacity,visibility,transition'

function listOf(targets: Targets): Element[] {
  return targets instanceof Element ? [targets] : [...(targets ?? [])]
}

type Listener = (moment: Moment) => void

// Everything below here is the browser's: the server never announces, never listens and never plays.
const listeners = new Set<Listener>()

/** The cue: what has been announced since the page was last drawn. By name, so a moment announced twice plays once. */
const cue = new Map<MomentName, Moment>()

/** Whether the next `first-load` to be announced will be heard. */
let firstLoadIsDue = true

/** Has the visitor asked for reduced motion? Asked each time, because the answer can change while the page is open. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isNamed<Name extends MomentName>(moment: Moment, name: Name): moment is MomentNamed<Name> {
  return moment.name === name
}

async function playCue(): Promise<void> {
  // Twice: once for the change that goes with the announcement to be made, if it has not been
  // yet, and once for the page to be drawn with it. Both are over before the browser paints.
  await nextTick()
  await nextTick()
  // A first load draws the planner for an account at rest, apart from the rack's fill. Anything
  // announced with it (the live block of the account just opened, say) is part of what was drawn,
  // not something the player did, so only the load plays.
  const firstLoad = cue.get('first-load')
  const moments = firstLoad ? [firstLoad] : [...cue.values()]
  cue.clear()
  if (prefersReducedMotion()) return
  for (const moment of moments) {
    // a copy, because a listener may be on its way out
    for (const listener of [...listeners]) listener(moment)
  }
}

/**
 * Says that a moment has happened. Call it in the same tick as the change that makes it one (a
 * store action, usually); the components listening hear of it once the page shows that change.
 */
export function announceMoment(moment: Moment): void {
  if (import.meta.server) return
  if (moment.name === 'first-load') {
    if (!firstLoadIsDue) return
    firstLoadIsDue = false
  }
  const isFirstSinceDrawn = cue.size === 0
  cue.set(moment.name, moment)
  if (isFirstSinceDrawn) void playCue()
}

/**
 * Says that the planner is about to be drawn for a different account (another account has been
 * opened, added or imported, or a new player's account has just loaded from the setup screen),
 * so the next `first-load` to be announced is heard again and the rack fills from empty.
 */
export function expectFirstLoad(): void {
  firstLoadIsDue = true
}

/**
 * Motion for the component that calls it: hearing moments, and moving its own elements. Call it
 * in `setup`. Tweens started through it are stopped, and their inline styles put back, when the
 * component is unmounted.
 */
export function useMotion(): Motion {
  // the server draws every screen at rest
  if (import.meta.server) {
    const still = (): void => undefined
    return { onMoment: still, arrive: still, rest: still, play: still }
  }

  const heard = new Set<Listener>()
  /** Every tween this component has started, so they can all be stopped together. */
  let context: gsap.Context | null = null

  onScopeDispose(() => {
    for (const listener of heard) listeners.delete(listener)
    context?.revert()
  })

  const play: Motion['play'] = (start) => {
    if (prefersReducedMotion()) return
    context ??= gsap.context(() => undefined)
    context.add(() => start(gsap))
  }

  const onMoment: Motion['onMoment'] = (name, playMoment) => {
    const listener: Listener = (moment) => {
      if (isNamed(moment, name)) playMoment(moment)
    }
    heard.add(listener)
    listeners.add(listener)
  }

  const rest: Motion['rest'] = (targets) => {
    const elements = listOf(targets)
    if (!elements.length) return
    // One at a time: GSAP only stops a tween outright when asked about exactly the elements it
    // moves, and `arrive` gives each element a tween of its own.
    for (const element of elements) gsap.killTweensOf(element)
    gsap.set(elements, { clearProps: DISPLACED_PROPERTIES })
  }

  const arrive: Motion['arrive'] = (targets, from, timing) => {
    const elements = listOf(targets)
    if (!elements.length) return
    play((tweens) => {
      // an element still on its way from last time starts again from rest, not from where it had got to
      rest(elements)
      // A CSS transition on a property being tweened would chase every frame, and would hide
      // where the element comes to rest from GSAP, which reads that from the styles.
      tweens.set(elements, { transition: 'none' })
      const { duration, ease, delay = 0, stagger = 0 } = timing
      elements.forEach((element, place) => {
        tweens.from(element, {
          ...from,
          duration,
          ease,
          delay: delay + place * stagger,
          clearProps: DISPLACED_PROPERTIES,
        })
      })
    })
  }

  return { onMoment, arrive, rest, play }
}
