import type { ObjectDirective } from 'vue'
import type { MotionTween } from './useMotion'

/**
 * A block arrives once its top is 12% of the window clear of the bottom edge. The area it is
 * watched for reaches far above the window too, so a block that is jumped past (the End key, a
 * link to further down) arrives all the same, rather than wait above the window held back.
 */
const ARRIVAL_MARGIN = '100000px 0px -12% 0px'

/** What a block does once it has arrived, if anything (a feature fills its cape). */
type OnArrival = (() => void) | undefined

interface WaitingBlock {
  /** The tween that brings the block in, held at its start until the block is scrolled to. */
  readonly arrival: MotionTween
  readonly onArrival: OnArrival
}

/**
 * `v-reveal`, for the blocks of a long page (the landing content): a block below the window when
 * the page opens eases in the first time it is scrolled to. Its value, if it has one, is called
 * as the block arrives.
 *
 * A block that is on screen when the page opens is left exactly as it is: the page was drawn
 * complete, and taking something away to bring it back would be a flash. So only what cannot be
 * seen yet is held back, and only by a visitor's browser that allows motion.
 *
 *   const vReveal = useReveal()
 *   <FaqList v-reveal :questions="QUESTIONS" />
 */
export function useReveal(): ObjectDirective<HTMLElement, OnArrival> {
  const motion = useMotion()
  const waiting = new Map<Element, WaitingBlock>()
  let observer: IntersectionObserver | null = null

  function reveal(entries: IntersectionObserverEntry[]): void {
    for (const { target, isIntersecting } of entries) {
      const block = waiting.get(target)
      if (!isIntersecting || !block) continue
      observer?.unobserve(target)
      waiting.delete(target)
      // motion may have been turned off since the block was held back: then it is simply shown
      if (prefersReducedMotion()) {
        block.arrival.progress(1)
        continue
      }
      block.arrival.play()
      block.onArrival?.()
    }
  }

  onScopeDispose(() => observer?.disconnect())

  return {
    mounted(element, { value: onArrival }) {
      if (element.getBoundingClientRect().top < window.innerHeight) return
      motion.play((tweens) => {
        const arrival = tweens.from(element, {
          autoAlpha: 0,
          y: 18,
          duration: 0.5,
          ease: 'power2.out',
          paused: true,
          clearProps: 'transform,opacity,visibility',
        })
        waiting.set(element, { arrival, onArrival })
        observer ??= new IntersectionObserver(reveal, { rootMargin: ARRIVAL_MARGIN })
        observer.observe(element)
      })
    },
    unmounted(element) {
      observer?.unobserve(element)
      waiting.delete(element)
    },
  }
}
