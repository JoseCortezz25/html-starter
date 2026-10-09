---
paths:
  - 'src/**/*.{ts,css}'
  - '**/*.html'
---

# Naming Rules

- All identifiers in English — variables, functions, types, constants, files, BEM classes, `data-*` attributes. No exceptions for domain terms. UI copy may be in any language.
- Files and directories: `kebab-case` (`contact-form.ts`, `site-header.css`).
- Animation modules: `src/scripts/animations/<organism>-animation.ts` exporting `init<Organism>Animation`.
- Form modules: `src/scripts/forms/<form-name>.ts` exporting `init<FormName>`.
- Message files: `src/scripts/messages/<scope>-messages.ts` (`validation-messages.ts`, `ui-messages.ts`).
- Functions and variables: `camelCase`. Types and interfaces: `PascalCase` (no `I` prefix). Global constants and message objects: `SCREAMING_SNAKE_CASE`.
- Booleans start with `is`, `has`, `should`, or `can`.
- Named exports only — no default exports in `src/` (enforced by ESLint).
- BEM: `block`, `block__element`, `block--modifier`; block name equals the component name in `data-component`.

Full guide → `.opencode/skills/naming-language/SKILL.md`.
