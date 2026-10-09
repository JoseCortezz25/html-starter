import { getComponentRoots, queryAll } from '../utils/dom';
import { gsap, MOTION_CONDITIONS } from '../utils/gsap';

export const initHeroAnimation = (): (() => void) => {
  const mm = gsap.matchMedia();

  getComponentRoots('organism/hero').forEach(hero => {
    const items = queryAll(hero, '[data-hero-item]');
    const shapes = queryAll(hero, '[data-hero-shape]');

    mm.add(
      MOTION_CONDITIONS,
      context => {
        const { canAnimate } = context.conditions ?? {};
        if (!canAnimate) return;

        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        timeline
          .from(items, { autoAlpha: 0, y: 32, duration: 0.9, stagger: 0.12 })
          .from(
            shapes,
            {
              autoAlpha: 0,
              scale: 0.6,
              duration: 1.1,
              stagger: 0.15,
              ease: 'back.out(1.6)'
            },
            '<0.2'
          );

        shapes.forEach((shape, index) => {
          gsap.to(shape, {
            y: index % 2 === 0 ? -14 : 14,
            duration: 3 + index,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            delay: 1.2
          });
        });
      },
      hero
    );
  });

  return () => mm.revert();
};
