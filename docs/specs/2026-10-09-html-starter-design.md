# html-starter — Design Spec

Date: 2026-10-09
Status: Approved

## Purpose

Lightweight scaffold for simple, temporary landing pages. Bridges the UX/UI team and the Front team: prototypes are built in plain HTML and later migrated to the Next.js harness (`../template-starter-nextjs`) with minimal friction.

## Stack

- Vite + TypeScript (strict)
- Tailwind CSS v4 via `@tailwindcss/vite`; styling with BEM classes + `@apply`
- GSAP (+ ScrollTrigger) for animations
- Just-validate for forms
- pnpm, Node >= 24
- ESLint (flat) + Prettier (same config as the Next template, incl. `prettier-plugin-tailwindcss`) + husky + lint-staged + commitlint (conventional, 100-char header)

Use the latest stable versions at implementation time (verify via docs).

## Structure

```
html-starter/
├── index.html                  # one HTML file per page, no partials
├── public/
├── src/
│   ├── main.ts                 # entry: imports styles, inits animations/forms
│   ├── styles/
│   │   ├── main.css            # @import "tailwindcss" + @theme tokens
│   │   └── components/{atoms,molecules,organisms}/*.css   # BEM + @apply
│   └── scripts/
│       ├── animations/         # one GSAP module per organism; gsap.matchMedia + prefers-reduced-motion
│       ├── forms/              # one Just-validate setup per form
│       ├── messages/           # validation-messages.ts (as const)
│       └── utils/
├── MIGRATION.md
├── CLAUDE.md / AGENTS.md / RULES.md
└── docs/specs/
```

Additional pages are registered in `vite.config.ts` (`build.rollupOptions.input`).

## Conventions

- One HTML per page; shared markup (header/footer) is duplicated by design.
- Every component root carries `data-component="<level>/<name>"` (`atom|molecule|organism`) and a BEM block class; elements use `block__element`, modifiers `block--modifier`.
- Component styles live in `src/styles/components/<level>/<name>.css` using `@apply`; no long utility chains in HTML except layout one-offs.
- English identifiers, kebab-case files, named exports, no `any`.
- Scripts select elements via `[data-component]` / `data-*` hooks, never via styling classes.
- Validation and UI text live in `src/scripts/messages/*.ts` as `as const` objects.
- Accessibility: semantic HTML, labels on all inputs, reduced-motion respected.

## Migration Contract (MIGRATION.md)

| html-starter | Next harness |
|---|---|
| `data-component="organism/hero"` | `src/domains/<domain>/components/organisms/hero.tsx` |
| `src/styles/components/<level>/<name>.css` | same path in Next `src/styles/components/` (1:1) |
| Just-validate rules in `scripts/forms/*` | Zod schema (`*.schema.ts`) + React Hook Form |
| `scripts/messages/validation-messages.ts` | domain `validation-messages.ts` |
| GSAP module in `scripts/animations/*` | `useGSAP` hook inside the component |

## AI Harness (Claude + OpenCode mirror)

Inspired by the Next template, adapted to HTML prototypes.

- `CLAUDE.md`, `AGENTS.md` (OpenCode copy with `.opencode/*` paths), `RULES.md` quick reference.
- `.claude/` and `.opencode/`:
  - `rules/` (path-scoped): styling, html-structure, naming, forms, animations, typescript.
  - `agents/`: `ux-ui-designer`, `html-builder`, `migration-auditor` (validates the migration contract).
  - `knowledge/`: `critical-constraints.md`, `migration-guide.md`.
  - `commands/`: `figma-to-html.md`.
  - `.claude/settings.json`: single PostToolUse hook → `.claude/hooks/format-and-lint.mjs` (Prettier + ESLint on edited file).
- `.agents/skills/` canonical skills (symlinked from `.claude/skills` and `.opencode/skills`): tailwind-4, typescript, naming-language, commit-conventions, frontend-design + official GSAP skills from `greensock/gsap-skills` (core, timeline, scrolltrigger, plugins, utils, performance, react), tracked in `skills-lock.json`.
- MCP (`.mcp.json` + `opencode.json`): playwright, chrome-devtools, figma-desktop. No shadcn.

Do NOT replicate known Next-harness gaps: unwired hooks, references to non-existent files, duplicated Prettier hook.

## Example

`index.html` landing with: header (organism), animated hero (organism + GSAP), contact form (organism + Just-validate), footer. Demonstrates every rule above.

## Verification

- `pnpm build`, `pnpm lint`, `pnpm typecheck` pass.
- Dev server renders the example; form validation and animations work; reduced-motion disables motion.
- Every file referenced by the harness exists.
