---
name: tailwind-4
description: >
  Tailwind CSS 4 patterns for this HTML starter: CSS-first @theme tokens, BEM component classes
  built with @apply, no var() or hex values in class lists.
  Trigger: When styling with Tailwind — editing src/styles/**/*.css, adding tokens, or writing classes in HTML.
license: Apache-2.0
metadata:
  version: '2.0'
---

## Setup in This Project

- Tailwind v4 runs through the `@tailwindcss/vite` plugin (`vite.config.ts`). There is no `tailwind.config.js`.
- `src/styles/main.css` is the single entry: `@import 'tailwindcss';`, the component imports, and the `@theme { }` block.
- Every `--color-*`, `--font-*`, `--radius-*`, `--shadow-*` variable in `@theme` becomes a utility (`--color-accent` → `bg-accent`, `text-accent`, `border-accent`).

## Styling Decision Tree

```
Reusable component style?      → BEM class in src/styles/components/<level>/<name>.css with @apply
Value exists as a token?       → use the token utility (bg-accent, font-display, rounded-card)
Reusable value without token?  → add it to @theme in main.css, then use the utility
One-off layout tweak in HTML?  → a short utility list is acceptable (e.g. class="mt-8")
Truly dynamic value (JS)?      → set a CSS custom property from the script, consume it in CSS
```

## Component Styles: BEM + @apply

```css
/* src/styles/components/atoms/button.css */
@layer components {
  .button {
    @apply inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold;
  }

  .button--primary {
    @apply bg-accent text-paper hover:bg-accent-strong;
  }
}
```

```html
<a class="button button--primary" data-component="atom/button" href="#contact"
  >Start</a
>
```

- Wrap component rules in `@layer components` so utilities can still override them.
- Register every new file in `src/styles/main.css` with `@import './components/<level>/<name>.css';`.
- Variants work inside `@apply` (`hover:`, `focus:`, `md:`, `disabled:`).
- `@apply` only accepts utilities — never `@apply` another BEM class. Compose in HTML instead (`class="button button--primary"`).
- Modifiers are separate classes (`block--modifier`), never string-built in JS.

## Critical Rules

### Never use var() or hex values in class lists

```html
<!-- ❌ NEVER -->
<div class="bg-[var(--color-accent)] text-[#1e293b]"></div>

<!-- ✅ ALWAYS: token utilities -->
<div class="bg-accent text-ink"></div>
```

### No inline styles

```html
<!-- ❌ -->
<section style="padding: 24px"></section>

<!-- ✅ -->
<section class="hero"></section>
```

### Conditional classes from scripts

Scripts toggle full BEM modifier classes with `classList`, never interpolated fragments:

```ts
// ✅
status.classList.toggle('contact-form__status--success', isSuccess);

// ❌
status.className = `contact-form__status--${state}`;
```

### Arbitrary values (escape hatch)

Allowed for one-off measurements that are not part of the design system (`tracking-[0.3em]`, `leading-[1.02]`). Never for colors — add a token instead.

## Common Patterns

```css
.layout {
  @apply mx-auto max-w-6xl px-6; /* container */
}
.grid-area {
  @apply grid gap-6 md:grid-cols-12; /* responsive grid, mobile-first */
}
.title {
  @apply font-display text-5xl font-semibold tracking-tight text-balance md:text-7xl;
}
.panel {
  @apply rounded-card bg-paper p-6 shadow-card;
}
```

## Keywords

tailwind, css, styling, @apply, @theme, bem, tokens, responsive
