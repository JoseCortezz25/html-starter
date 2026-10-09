---
description: Convert a Figma frame into HTML + BEM/@apply component styles following this project's conventions.
---

# figma-to-html

**Stack:** Vite, HTML, Tailwind CSS v4 (`@theme` tokens + BEM `@apply`), GSAP, Just-validate.

ALWAYS inspect the design with the Figma Desktop MCP (`figma-desktop`). Never guess values.

## Always read first

- `src/styles/main.css` — the `@theme { }` block is the single source of truth for colors, fonts, radius, and shadows.
- `.opencode/knowledge/critical-constraints.md`
- `.opencode/rules/styling.md` and `.opencode/rules/html-structure.md`

## Process

1. **Inspect** the selected Figma frame (layout, variables, typography, spacing, assets). Take a screenshot for reference.
2. **Decompose** it into Atomic Design levels: atoms (button, input), molecules (form-field, nav), organisms (page sections). Reuse existing components in `src/styles/components/**` before creating new ones.
3. **Tokens** — for every Figma value:
   - matching `@theme` variable exists → use its utility (`--color-accent` → `bg-accent`);
   - reusable value without a token → add it to `@theme` in `src/styles/main.css` (Figma alias `brand/red` → `--color-brand-red`);
   - one-off measurement → arbitrary utility inside `@apply` (`tracking-[0.3em]`). Never arbitrary colors.
4. **Markup** — write semantic HTML in the page file. Each component root gets `data-component="<level>/<name>"` and the BEM block class. No inline styles; no long utility chains.
5. **Styles** — create `src/styles/components/<level>s/<name>.css` with `@layer components { }` and `@apply`; register it in `src/styles/main.css`.
6. **Behavior** — motion → `src/scripts/animations/<organism>-animation.ts` (inside `gsap.matchMedia()`); forms → `src/scripts/forms/<form-name>.ts` with messages in `src/scripts/messages/`. Wire them in `src/main.ts`.
7. **Assets** — export images/icons to `public/` with kebab-case English names; decorative SVGs get `aria-hidden="true"`.
8. **Verify** — run `pnpm typecheck && pnpm lint && pnpm build`, then compare the page in the browser (Playwright or Chrome DevTools MCP) against the Figma screenshot at mobile and desktop widths.

## Do not

- Do not add CSS comments or HTML comments describing the design.
- Do not use `var()` or hex values in class lists.
- Do not select elements in scripts by styling classes.
