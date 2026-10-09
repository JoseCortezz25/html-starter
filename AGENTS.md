# AGENTS.md — Project Context for AI Agents

Guidance for OpenCode in this repository. (Claude Code uses `CLAUDE.md` and its own `.claude` directory.)

## Project Overview

`html-starter` is a lightweight scaffold for simple, temporary landing pages. The UX/UI team builds prototypes in plain HTML; the Front team later migrates them to the Next.js harness (`../template-starter-nextjs`). Every convention here exists to make that migration mechanical — see `MIGRATION.md`.

**Tech Stack**: Vite, TypeScript (strict), Tailwind CSS v4 (`@tailwindcss/vite`, BEM + `@apply`), GSAP + ScrollTrigger, Just-validate, pnpm, Node >= 24.

## 🔴 CRITICAL — READ FIRST

**Before doing anything else**, read `.opencode/knowledge/critical-constraints.md`. Violating those rules is unacceptable.

## Designer Mode

A restricted mode for non-technical UX/UI designers. It turns on automatically when the current git branch starts with `design/` (for example `design/landing-hero`). On any other branch nothing changes.

### What the designer can do

| Area                   | On a `design/*` branch                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pages and `src/**`     | ✅ Edit freely — project conventions still apply (BEM + `@apply`, `data-component`, `@theme` tokens)        |
| `public/`              | ✅ Add files, change/remove files they added · ❌ files already on `main`, the folder itself                |
| Setup files (below)    | ❌ Locked                                                                                                   |
| Commands               | ✅ `pnpm dev/build/preview/lint/typecheck/format`, plain `pnpm install`, read-only commands                 |
| Dependencies & tooling | ❌ `pnpm add/remove`, other scripts, interpreters (`node`, `bash -c`…), unknown tools                       |
| Git                    | ✅ `status`, `diff`, `log`, `add`, `commit`, `stash`, `pull`, create/switch/push `design/*` branches        |
| Git (blocked)          | ❌ Push to `main`/`stage`/non-design refs, force push, `--no-verify`, `reset --hard`, `rebase`, hook config |

**Locked setup files:** `.agents/`, `.claude/`, `.opencode/`, `.husky/`, `.git/`, `.github/`, `.vscode/`, `docs/`, `node_modules/`; `CLAUDE.md`, `AGENTS.md`, `RULES.md`, `README.md`, `MIGRATION.md`, `opencode.json`, `.mcp.json`, `package.json`, lockfiles, `pnpm-workspace.yaml`, `skills-lock.json`, `tsconfig*.json`, `*.config.{ts,js,mjs,cjs}`, `.prettierrc*`, `.prettierignore`, `.editorconfig`, `.gitignore`, `.npmrc`, `.nvmrc`, `.node-version`, `.env*`.

**"Already on `main`"** means the path exists in `main` (or `origin/main`). If neither exists yet, the repository's first commit is the baseline; in a repository with no commits, files already on disk count as pre-existing.

### How to talk to the designer

- The user is a designer, not a developer. Be intuitive, explanatory and easy to follow. Light technical terms are fine; avoid jargon depth and harsh or alarming words.
- Reply in the designer's language.
- When something fails, explain in simple terms what happened and what they can do next.
- If a request is outside their scope (locked files, configuration, dependencies, git beyond design branches, build/tooling errors they can't fix), kindly tell them to ask a developer and give them a short summary they can pass along.
- Never try to work around a Designer Mode block.

### Enforcement (for developers)

- Single policy module: `.claude/hooks/lib/designer-policy.mjs` (tests: `pnpm test:guards`).
- Claude Code: `PreToolUse` → `.claude/hooks/designer-guard.mjs` (blocks with exit code 2); `SessionStart` / `UserPromptSubmit` → `.claude/hooks/designer-context.mjs` (announces the mode).
- OpenCode: `.opencode/plugins/designer-guard.js` (`tool.execute.before` + system prompt briefing).
- Git: `.husky/pre-commit` and `.husky/pre-push` run `.claude/hooks/designer-git-check.mjs`, so the rules also apply without any AI agent.
- These are **guardrails, not security**: `--no-verify`, `HUSKY=0` or editing files by hand skip them. Protect `main` and `stage` with branch protection rules on the remote (GitHub) — that is the real enforcement.

## General Rules

- **Pages**: one HTML file per page at the root, no partials. Extra pages go in `vite.config.ts` → `build.rolldownOptions.input`.
- **Components**: Atomic Design. Every component root has `data-component="<atom|molecule|organism>/<name>"` and a BEM block class `<name>`.
- **Styling**: tokens in `@theme` (`src/styles/main.css`); component styles in `src/styles/components/<level>s/<name>.css` with `@layer components` + `@apply`. No inline styles, no `var()`/hex in class lists.
- **Scripts**: select via `data-component` / `data-*` hooks, never styling classes. One animation module per organism, one form module per form.
- **Motion**: GSAP inside `gsap.matchMedia()` honoring `prefers-reduced-motion`.
- **Forms**: Just-validate with the `Rules` enum; messages in `src/scripts/messages/*.ts` (`as const`).
- **TypeScript**: strict, no `any`, named exports, English identifiers, kebab-case files.
- **Accessibility**: semantic landmarks, labeled inputs, linked errors, visible focus.

## Project Structure

```
index.html                         # one HTML file per page
public/                            # static assets
src/main.ts                        # entry: styles + animation/form init
src/styles/main.css                # @import 'tailwindcss' + component imports + @theme
src/styles/components/{atoms,molecules,organisms}/*.css
src/scripts/animations/            # <organism>-animation.ts (GSAP)
src/scripts/forms/                 # <form-name>.ts (Just-validate)
src/scripts/messages/              # validation-messages.ts, ui-messages.ts
src/scripts/utils/                 # dom.ts, gsap.ts
```

## Commands

| Command            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | Vite dev server                          |
| `pnpm build`       | `tsc --noEmit && vite build` → `dist/`   |
| `pnpm preview`     | Serve the production build               |
| `pnpm lint`        | ESLint (flat config, typescript-eslint)  |
| `pnpm typecheck`   | `tsc --noEmit`                           |
| `pnpm format`      | Prettier (with Tailwind class sorting)   |
| `pnpm test:guards` | Designer Mode policy tests (`node:test`) |

`pnpm typecheck`, `pnpm lint`, and `pnpm build` must pass before handing off work.

## Specialized Agents

Subagents (`mode: subagent`); they produce plans or reports and the primary agent executes:

- **UX/UI design** → `.opencode/agents/ux-ui-designer.md`
- **HTML implementation planning** → `.opencode/agents/html-builder.md`
- **Migration readiness audit** → `.opencode/agents/migration-auditor.md`

## Documentation Map

Always read: `.opencode/knowledge/critical-constraints.md`.

Load as needed:

- `.opencode/knowledge/migration-guide.md` — migration contract and readiness checks
- `MIGRATION.md` — human migration guide with a full example
- `RULES.md` — one-page quick reference

## Coding Rules

Auto-applied by path from `.opencode/rules/`:

| Rule                | Applies to                                                     | Description                                         |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `styling.md`        | `src/styles/**/*.css`, `**/*.html`                             | Tokens, BEM, `@apply`, no inline styles             |
| `html-structure.md` | `**/*.html`                                                    | Pages, `data-component`, script hooks, a11y         |
| `naming.md`         | `src/**/*.{ts,css}`, `**/*.html`                               | English identifiers, kebab-case, BEM, named exports |
| `forms.md`          | `src/scripts/forms/**`, `src/scripts/messages/**`, `**/*.html` | Just-validate, messages, accessible errors          |
| `animations.md`     | `src/scripts/animations/**`, `src/scripts/utils/gsap.ts`       | GSAP, matchMedia, reduced motion, cleanup           |
| `typescript.md`     | `src/**/*.ts`, `*.config.ts`                                   | Strict TS, no `any`, type imports                   |

## Commands

- `/figma-to-html` → `.opencode/commands/figma-to-html.md` — convert a Figma frame into HTML + component CSS.

## Skills

Canonical source: `.agents/skills/`. `.claude/skills` and `.opencode/skills` are symlinks to it.

| Skill                | Description                                                 | Source                                                                              |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tailwind-4`         | Tailwind v4 `@theme` tokens, BEM + `@apply`, no var()/hex   | [.opencode/skills/tailwind-4](.opencode/skills/tailwind-4/SKILL.md)                 |
| `gsap-core`          | Official: gsap.to/from/fromTo, easing, stagger, matchMedia  | [.opencode/skills/gsap-core](.opencode/skills/gsap-core/SKILL.md)                   |
| `gsap-timeline`      | Official: timelines, position parameter, sequencing         | [.opencode/skills/gsap-timeline](.opencode/skills/gsap-timeline/SKILL.md)           |
| `gsap-scrolltrigger` | Official: scroll-linked animation, pinning, scrub           | [.opencode/skills/gsap-scrolltrigger](.opencode/skills/gsap-scrolltrigger/SKILL.md) |
| `gsap-plugins`       | Official: plugin registration, SplitText, Flip, ScrollTo    | [.opencode/skills/gsap-plugins](.opencode/skills/gsap-plugins/SKILL.md)             |
| `gsap-utils`         | Official: gsap.utils helpers (clamp, mapRange, toArray)     | [.opencode/skills/gsap-utils](.opencode/skills/gsap-utils/SKILL.md)                 |
| `gsap-performance`   | Official: transforms, batching, avoiding jank               | [.opencode/skills/gsap-performance](.opencode/skills/gsap-performance/SKILL.md)     |
| `gsap-react`         | Official: useGSAP/cleanup — reference for migration to Next | [.opencode/skills/gsap-react](.opencode/skills/gsap-react/SKILL.md)                 |
| `typescript`         | TypeScript strict patterns, types, generics                 | [.opencode/skills/typescript](.opencode/skills/typescript/SKILL.md)                 |
| `naming-language`    | English-only identifiers                                    | [.opencode/skills/naming-language](.opencode/skills/naming-language/SKILL.md)       |
| `commit-conventions` | Conventional commit messages compatible with commitlint     | [.opencode/skills/commit-conventions](.opencode/skills/commit-conventions/SKILL.md) |
| `frontend-design`    | Distinctive typography, color, and motion choices           | [.opencode/skills/frontend-design](.opencode/skills/frontend-design/SKILL.md)       |

## MCP Servers

Defined in `opencode.json` (`mcp`):

- **playwright** — browser automation and visual checks
- **chrome-devtools** — inspection, performance, console
- **figma-desktop** — design context, variables, screenshots (requires the Figma desktop app MCP server)

Enable only what the current task needs.

## Formatting

`opencode.json` configures the `prettier` formatter (local `node_modules/.bin/prettier`) for edited `.ts`, `.js`, `.mjs`, `.json`, `.css`, `.html`, and `.md` files. Run `pnpm lint` to apply ESLint.

## Plugins

`.opencode/plugins/designer-guard.js` enforces Designer Mode on `design/*` branches (blocks `edit`/`write`/`apply_patch`/`bash` calls the shared policy denies and adds a Designer Mode briefing to the system prompt). It is a no-op on other branches.

## Git

- Conventional commits only (`type(scope): description`, header ≤ 100 chars), enforced by commitlint in `.husky/commit-msg`; `lint-staged` runs in `.husky/pre-commit`. On `design/*` branches `.husky/pre-commit` and `.husky/pre-push` also run the Designer Mode git checks.
- **No AI attribution**: never add `Co-Authored-By` trailers for AI tools, "Generated with" lines, or assistant signatures to commits or PRs.
- Full rules → `.opencode/skills/commit-conventions/SKILL.md`.

## Pre-Work Checklist

- [ ] Read `.opencode/knowledge/critical-constraints.md`.
- [ ] Know which rules apply to the files you will touch (`.opencode/rules/`).
- [ ] New component? Decide level, name, BEM block, and CSS file before writing markup.
- [ ] Finish with `pnpm typecheck && pnpm lint && pnpm build`.
