---
paths:
  - 'src/styles/**/*.css'
  - '**/*.html'
---

# Styling Rules

Tailwind CSS v4 (CSS-first, `@tailwindcss/vite`) with BEM component classes built from `@apply`.

## Tokens

- `src/styles/main.css` is the single source of truth: `@import 'tailwindcss';`, component imports, and the `@theme { }` block.
- Always use token utilities (`bg-accent`, `text-ink`, `font-display`, `rounded-card`, `shadow-card`).
- Reusable value without a token → add it to `@theme` first, then use the utility.
- Never `var()` or hex colors inside class lists (`bg-[var(--x)]`, `text-[#fff]`).

## Component files

- One file per component: `src/styles/components/<atoms|molecules|organisms>/<name>.css`, kebab-case, named after the BEM block.
- Wrap rules in `@layer components { }` and build them with `@apply`. Raw CSS only for properties Tailwind cannot express.
- Register every new file in `src/styles/main.css` via `@import`.
- `@apply` only utilities — never another BEM class.

## BEM

- Block: `.hero`; element: `.hero__title`; modifier: `.hero__shape--sun`, `.button--primary`.
- Keep names short; never chain `block__element__element` or `block__element--modifier--state`.
- State that comes from scripts is a modifier class (`.text-input--invalid`) or an ARIA attribute, never inline styles.

## HTML

- No `style="..."` attributes.
- Long utility chains in HTML are forbidden; a short utility list for a one-off layout tweak is acceptable.
- Mobile-first: base styles for small screens, `md:` / `lg:` for larger.
