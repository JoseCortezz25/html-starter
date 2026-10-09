---
paths:
  - 'src/**/*.ts'
  - '*.config.ts'
---

# TypeScript Rules

- `strict` mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (see `tsconfig.json`). Do not relax them.
- Never use `any` — use `unknown`, generics, or precise DOM types (`querySelector<HTMLFormElement>`).
- No non-null assertions (`!`) on DOM queries; use `queryRequired()` from `src/scripts/utils/dom.ts` or handle `null` explicitly.
- Named exports only; no default exports in `src/`.
- `import type` for type-only imports (enforced by ESLint `consistent-type-imports`).
- Const objects with `as const` instead of `enum` or loose string unions (`erasableSyntaxOnly` forbids TS enums).
- No unused variables or parameters; prefix intentionally unused ones with `_`.
- `console.*` is a lint warning — remove before committing.
- Keep modules small and single-purpose: one organism per animation module, one form per form module.

Reference → `.opencode/skills/typescript/SKILL.md`.
