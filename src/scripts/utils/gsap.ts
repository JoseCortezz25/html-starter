import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const MOTION_CONDITIONS = {
  canAnimate: '(prefers-reduced-motion: no-preference)',
  prefersReducedMotion: '(prefers-reduced-motion: reduce)'
} as const;

export { gsap, ScrollTrigger };
