# Critical Constraints

**Non-negotiable rules for every change in this project.** Details live in `.claude/rules/*.md`.

---

## 1. One HTML file per page, no partials

❌ Template engines, HTML includes, or JS-rendered layout.
✅ Each page is a standalone `.html` at the root; header/footer are duplicated. Extra pages are registered in `vite.config.ts` → `build.rolldownOptions.input`.

## 2. Every component root is identifiable

❌ `<section class="hero">`
✅ `<section class="hero" data-component="organism/hero">`

`data-component="<atom|molecule|organism>/<name>"` + BEM block class `<name>`. This is the migration key.

## 3. Styles: BEM + `@apply` in component files

❌ Long utility chains in HTML, inline `style`, `bg-[var(--x)]`, `text-[#fff]`.
✅ `src/styles/components/<level>/<name>.css` with `@layer components { .block { @apply ...; } }`, tokens from `@theme` in `src/styles/main.css`.

## 4. Scripts never depend on styling classes

❌ `document.querySelector('.hero__title')`
✅ `document.querySelector('[data-hero-item]')` / `[data-component="organism/hero"]`

## 5. Motion respects reduced motion

❌ Calling `gsap.to/from/timeline` outside `gsap.matchMedia()`.
✅ Every animation inside `gsap.matchMedia()` with `MOTION_CONDITIONS`; content visible when motion is off.

## 6. Forms use Just-validate with external messages

❌ Hardcoded error strings, string rule names, `required` attribute-only validation.
✅ `Rules` enum + messages from `src/scripts/messages/validation-messages.ts` (`as const`), accessible error containers.

## 7. TypeScript strict, no `any`, named exports, English identifiers

❌ `any`, default exports in `src/`, Spanish identifiers, PascalCase/camelCase file names.
✅ `unknown`/precise types, `export const`, English identifiers, `kebab-case` files.

## 8. Accessibility is part of done

Semantic landmarks, labeled inputs, linked errors, visible focus, decorative elements `aria-hidden`.

## 9. Quality gates must pass

`pnpm typecheck`, `pnpm lint`, `pnpm build` must pass before handing off work.

## 10. Commits

Conventional commits (`type(scope): description`, header ≤ 100 chars). **No AI attribution** — no `Co-Authored-By` trailers for AI tools, no "Generated with" lines.
