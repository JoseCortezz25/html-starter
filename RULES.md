# RULES.md — Code Culture

Quick-reference card for this project's non-negotiable conventions.
Full detail in `.claude/rules/` (or `.opencode/rules/`) and `.claude/knowledge/critical-constraints.md` (or `.opencode/knowledge/critical-constraints.md`).

---

## Pages

- One HTML file per page at the project root — no partials, no templating
- Shared markup (header, footer) is duplicated by design
- Register extra pages in `vite.config.ts` → `build.rolldownOptions.input`

---

## Components

- Atomic Design: atoms → molecules → organisms
- Every component root: `data-component="<atom|molecule|organism>/<name>"` + BEM block class `<name>`
- Component name = `data-component` name = CSS file name = future React file name

---

## Styling

- Tailwind v4 tokens live in `@theme` inside `src/styles/main.css`
- Component styles: `src/styles/components/<level>s/<name>.css`, `@layer components` + `@apply`, imported in `main.css`
- BEM: `block`, `block__element`, `block--modifier` — short names, no deep chains
- No inline styles, no `var()` or hex colors in class lists, no long utility chains in HTML
- Mobile-first responsive design

---

## Scripts

- Select elements via `data-component` / `data-*` hooks — never styling classes
- One animation module per organism: `src/scripts/animations/<organism>-animation.ts`
- One form module per form: `src/scripts/forms/<form-name>.ts`
- Wire everything in `src/main.ts`

---

## Motion

- GSAP (+ ScrollTrigger) only, imported from `src/scripts/utils/gsap.ts`
- Every animation inside `gsap.matchMedia()` with `MOTION_CONDITIONS` — reduced motion means no motion
- `gsap.from()` reveals so content is visible without JS
- Animate transforms and opacity only; return a cleanup function

---

## Forms

- Just-validate with the `Rules` enum, named numeric constants
- Messages in `src/scripts/messages/validation-messages.ts` (`as const`); UI text in `ui-messages.ts`
- Labels on every input, errors linked with `aria-describedby` + `aria-live="polite"`, `aria-invalid` on invalid fields
- Every rule must have a Zod equivalent (see `MIGRATION.md`)

---

## TypeScript

- Strict mode; never `any` — use `unknown` or precise types
- Named exports only (no default exports in `src/`)
- `import type` for type-only imports
- `camelCase` functions/variables, `PascalCase` types, `SCREAMING_SNAKE_CASE` constants and message objects
- Booleans prefixed `is`, `has`, `should`, `can`

---

## Naming

- English identifiers everywhere — no exceptions for domain terms (UI copy may be any language)
- Files and directories: `kebab-case`

---

## Quality Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm build` must pass
- Prettier + ESLint run on staged files (husky + lint-staged)

---

## Git

- Conventional commits only: `type(scope): description`, header ≤ 100 characters (commitlint)
- **No AI attribution** — no `Co-Authored-By` trailers for AI tools, no "Generated with" lines
- Full rules → `.claude/skills/commit-conventions/SKILL.md` or `.opencode/skills/commit-conventions/SKILL.md`

---

## Designer Mode

- Active automatically on branches named `design/*` (for UX/UI designers working with an AI agent)
- Editable: pages and `src/**`; in `public/` only new files (or files added on the branch)
- Locked: harness/config/docs folders, root docs, `package.json` + lockfiles, `tsconfig*`, `*.config.*`, dotfiles, `.env*`
- Git: commit and push only `design/*` branches — no force push, `--no-verify`, `rebase`, `reset --hard`
- Guardrails only; protect `main`/`stage` with remote branch protection. Details → `CLAUDE.md` / `AGENTS.md` → "Designer Mode"
