---
name: frontend-design
description: Create distinctive, creative frontend designs that avoid generic "AI slop" aesthetics. Focus on unique typography, cohesive color palettes, atmospheric backgrounds, and well-orchestrated motion.
compatibility: opencode
---

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:

- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. In this project use GSAP (see the `gsap` skill) inside `gsap.matchMedia()` so `prefers-reduced-motion` is always honored; CSS transitions are fine for hover/focus states. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:

- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
- Filler status copy such as "all systems operational"

Project constraints still apply: tokens live in `@theme` inside `src/styles/main.css`, component styles use BEM + `@apply` in `src/styles/components/<level>/<name>.css`, and every component root carries `data-component="<level>/<name>"`.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
