import { useEffect, type RefObject } from 'react';

// How fast the hero text scrolls up compared with the page: 1 = the same speed, 1.5 = half as fast
// again (it "runs away" from the photo that stays pinned behind it). Raise it for a stronger effect,
// and change the matching offset in HomePage.module.scss (@keyframes heroLift) with it.
export const HERO_TEXT_SPEED = 1.5;

// Fallback for browsers without CSS scroll-driven animations, which do this in the stylesheet
// instead (in step with the scrolling, so without the one-frame lag of a scroll listener).
// Moves `ref` up by the extra distance (HERO_TEXT_SPEED − 1) × scroll, via the CSS variable
// `--hero-lift` that the stylesheet turns into a transform (so it doesn't touch the layout and
// can't cause layout shifts). Nothing for visitors who ask for reduced motion.
export function useHeroTextParallax(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    if (CSS.supports('animation-timeline', 'scroll()')) return; // the stylesheet animates it

    let frame = 0;
    const update = () => {
      frame = 0;
      // Past one screen the text is long gone, so stop adding to the offset.
      const lift = (HERO_TEXT_SPEED - 1) * Math.min(window.scrollY, window.innerHeight);
      el.style.setProperty('--hero-lift', `${-lift}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update); // at most once per frame
    };

    update(); // correct from the start, e.g. when the browser restores the scroll position
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
      el.style.removeProperty('--hero-lift');
    };
  }, [ref]);
}
