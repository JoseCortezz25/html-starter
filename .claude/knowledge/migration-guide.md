# Migration Guide (Agent Reference)

Source of truth for humans: `MIGRATION.md` at the project root (full step-by-step example). This file is the condensed contract agents validate against.

## Contract

| html-starter                                  | Next harness (`../template-starter-nextjs`)           |
| --------------------------------------------- | ----------------------------------------------------- |
| `data-component="<level>/<name>"`             | `src/domains/<domain>/components/<level>s/<name>.tsx` |
| `src/styles/components/<level>/<name>.css`    | same path in Next `src/styles/components/` (1:1)      |
| `@theme` tokens in `src/styles/main.css`      | `@theme inline` in `src/app/globals.css`              |
| Just-validate rules in `src/scripts/forms/*`  | Zod schema (`*.schema.ts`) + React Hook Form          |
| `src/scripts/messages/validation-messages.ts` | domain `validation-messages.ts`                       |
| `src/scripts/messages/ui-messages.ts`         | domain `messages.ts`                                  |
| GSAP module in `src/scripts/animations/*`     | `useGSAP` hook inside the component                   |

## Migration-readiness checks

1. **Component identity** — every component root has `data-component="<atom|molecule|organism>/<name>"`, a BEM block class equal to `<name>`, and (for styled components) a CSS file at `src/styles/components/<level>s/<name>.css` imported in `main.css`.
2. **Styles** — component CSS uses `@layer components` + `@apply`; no inline `style` attributes; no `var()`/hex in class lists; colors come from `@theme` tokens.
3. **Script hooks** — scripts select via `data-component`/`data-*` only; no styling-class selectors (`querySelector('.hero__title')` is a violation).
4. **Forms** — each form module uses the `Rules` enum, named numeric constants, and messages from `validation-messages.ts`; every rule has a Zod equivalent (`Required → .min(1)`, `Email → z.email()`, `MinLength → .min(n)`, `MaxLength → .max(n)`, `CustomRegexp → .regex()`, custom `validator` → `.refine()` and must be documented).
5. **Animations** — one module per organism, all tweens inside `gsap.matchMedia()` with `MOTION_CONDITIONS`, targets scoped to the organism root, returns cleanup. These map directly to `useGSAP(() => { ... }, { scope })`.
6. **Text** — user-facing strings set from scripts live in `src/scripts/messages/*.ts` (`as const`). HTML copy is fine in HTML (it moves to domain `messages.ts` during migration).
7. **Accessibility** — labels, `aria-describedby`, `aria-live` error containers, landmarks, reduced motion.

## Level folder naming

`data-component` uses the singular level (`organism/hero`); CSS and Next folders use the plural (`organisms/hero.css`, `components/organisms/hero.tsx`).
