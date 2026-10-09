# html-starter

Lightweight scaffold for simple, temporary landing pages. The UX/UI team builds prototypes in plain HTML; the Front team migrates them to a Next.js project with minimal friction.

## Stack

- [Vite](https://vite.dev) + TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite` — BEM classes built with `@apply`
- [GSAP](https://gsap.com) + ScrollTrigger for animation
- [Just-validate](https://just-validate.dev) for forms
- ESLint (flat, typescript-eslint) + Prettier (`prettier-plugin-tailwindcss`) + husky + lint-staged + commitlint
- pnpm, Node >= 24 (`.nvmrc`)

## Getting started

```bash
nvm use
pnpm install
pnpm dev
```

## Scripts

| Script             | Description                                |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Start the Vite dev server                  |
| `pnpm build`       | Type-check and build to `dist/`            |
| `pnpm preview`     | Serve the production build locally         |
| `pnpm lint`        | Run ESLint                                 |
| `pnpm typecheck`   | Run `tsc --noEmit`                         |
| `pnpm format`      | Format everything with Prettier            |
| `pnpm prepare`     | Install git hooks (runs on `pnpm install`) |
| `pnpm test:guards` | Run the Designer Mode policy tests         |

## Structure

```
index.html                  # one HTML file per page, no partials
public/
src/
├── main.ts                 # entry: imports styles, inits animations and forms
├── styles/
│   ├── main.css            # @import 'tailwindcss' + component imports + @theme tokens
│   └── components/{atoms,molecules,organisms}/*.css
└── scripts/
    ├── animations/         # one GSAP module per organism
    ├── forms/              # one Just-validate module per form
    ├── messages/           # validation-messages.ts, ui-messages.ts (as const)
    └── utils/              # dom.ts, gsap.ts
```

Additional pages: create `about.html` at the root and add it to `build.rolldownOptions.input` in `vite.config.ts`.

## Conventions (summary)

- Every component root carries `data-component="<atom|molecule|organism>/<name>"` and a BEM block class.
- Component styles live in `src/styles/components/<level>s/<name>.css` using `@apply`; tokens live in `@theme`.
- Scripts select elements via `data-*` hooks, never styling classes.
- Animations run inside `gsap.matchMedia()` and respect `prefers-reduced-motion`.
- Validation and script-driven UI text live in `src/scripts/messages/*.ts` as `as const` objects.
- English identifiers, kebab-case files, named exports, no `any`.
- Conventional commits (≤ 100-char header), no AI attribution.

Full quick reference: [RULES.md](RULES.md). AI agent context: [CLAUDE.md](CLAUDE.md) (Claude Code) and [AGENTS.md](AGENTS.md) (OpenCode).

## Designer Mode

Designers work on branches named `design/*` (for example `git checkout -b design/landing-hero`). On those branches Claude Code, OpenCode and the git hooks switch to a restricted mode: pages, `src/**` and new files in `public/` are editable, while project setup (config, dependencies, AI harness, docs) is locked and only `design/*` branches can be pushed. The agent also adapts its tone for non-technical users.

These are guardrails, not security — configure branch protection for `main` and `stage` on GitHub. Full details: "Designer Mode" in [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md).

## Migration to Next.js

See [MIGRATION.md](MIGRATION.md) for the mapping contract and a step-by-step example (hero + contact form → React components, Zod schema, `useGSAP`).
