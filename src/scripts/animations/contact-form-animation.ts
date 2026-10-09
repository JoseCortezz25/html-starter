import { getComponentRoots, queryAll } from '../utils/dom';
import { gsap, MOTION_CONDITIONS } from '../utils/gsap';

export const initContactFormAnimation = (): (() => void) => {
  const mm = gsap.matchMedia();

  getComponentRoots('organism/contact-form').forEach(section => {
    const items = queryAll(section, '[data-reveal-item]');

    mm.add(
      MOTION_CONDITIONS,
      context => {
        const { canAnimate } = context.conditions ?? {};
        if (!canAnimate) return;

        gsap.from(items, {
          autoAlpha: 0,
          y: 48,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            once: true
          }
        });
      },
      section
    );
  });

  return () => mm.revert();
};
