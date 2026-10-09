---
paths:
  - 'src/scripts/animations/**/*.ts'
  - 'src/scripts/utils/gsap.ts'
---

# Animation Rules

All motion uses **GSAP** (+ ScrollTrigger).

- One module per organism: `src/scripts/animations/<organism>-animation.ts` exporting `init<Organism>Animation(): () => void` that returns a cleanup function.
- Import `gsap`, `ScrollTrigger`, and `MOTION_CONDITIONS` from `src/scripts/utils/gsap.ts`; plugins are registered only there.
- **Every animation lives inside `gsap.matchMedia()`** using `MOTION_CONDITIONS`. When `canAnimate` is false, return without animating — content must remain visible.
- Use `gsap.from()` / `autoAlpha` for reveals so the CSS state is the final, accessible state (works without JS and with reduced motion).
- Scope selectors to the organism root (third argument of `mm.add`) and target `data-*` hooks (`[data-hero-item]`), never styling classes.
- Animate transforms and opacity only; never layout properties.
- Infinite or scroll-linked animations must be created inside matchMedia so `mm.revert()` cleans them up.
- Keep one timeline per organism entrance; avoid scattered micro-animations.

Reference → official GSAP skills: `.claude/skills/gsap-core/SKILL.md`, `.claude/skills/gsap-timeline/SKILL.md`, `.claude/skills/gsap-scrolltrigger/SKILL.md`, `.claude/skills/gsap-performance/SKILL.md`.
