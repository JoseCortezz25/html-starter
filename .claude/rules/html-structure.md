---
paths:
  - '**/*.html'
---

# HTML Structure Rules

## Pages

- One HTML file per page at the project root (`index.html`, `about.html`, ...). No partials or templating — shared markup (header, footer) is duplicated by design.
- Register every extra page in `vite.config.ts` → `build.rolldownOptions.input`.
- Each page loads one entry: `<script type="module" src="/src/main.ts"></script>` (or a page-specific entry under `src/`).

## Components (Atomic Design)

- Every component root carries `data-component="<level>/<name>"` where level is `atom`, `molecule`, or `organism`, plus its BEM block class:

```html
<section
  class="hero"
  data-component="organism/hero"
  aria-labelledby="hero-title"
>
  ...
</section>
```

- The `<name>` matches the CSS file (`src/styles/components/organisms/hero.css`) and the future React component file (`hero.tsx`).
- Atoms: single element (button, input). Molecules: small groups of atoms (form-field, site-nav). Organisms: page sections (site-header, hero, contact-form, site-footer).

## Script hooks

- Scripts select via `[data-component="..."]` or dedicated `data-*` hooks (`data-hero-item`, `data-contact-form`, `data-field-error="email"`).
- Never use styling classes as JS selectors.

## Accessibility

- Semantic landmarks: `header`, `nav` (with `aria-label`), `main`, `section` (with `aria-labelledby`), `footer`.
- One `h1` per page; heading levels never skip.
- Every input has a `<label for>`; hints and errors are linked via `aria-describedby`; error containers use `aria-live="polite"`.
- Decorative elements get `aria-hidden="true"`; images get meaningful `alt` (or `alt=""` when decorative).
- Visible focus states are mandatory.
