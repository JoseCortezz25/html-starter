---
paths:
  - 'src/scripts/forms/**/*.ts'
  - 'src/scripts/messages/**/*.ts'
  - '**/*.html'
---

# Forms Rules

All forms use **Just-validate** (`just-validate` v4).

## Structure

- One module per form: `src/scripts/forms/<form-name>.ts` exporting `init<FormName>(): JustValidate | null`, called from `src/main.ts`.
- Select the form with a `data-*` hook (`[data-contact-form]`), never a styling class.
- Add `novalidate` to the `<form>` so Just-validate owns validation UX.
- Use the `Rules` enum (`Rules.Required`, `Rules.Email`, `Rules.MinLength`) — never string literals.
- Numeric constraints are named constants (`NAME_MIN_LENGTH`) so they can be copied into the Zod schema during migration.

## Messages

- Every error message comes from `src/scripts/messages/validation-messages.ts` (`as const`). Dynamic messages are functions: `minLength: (min: number) => ...`.
- Status and button text set from scripts come from `src/scripts/messages/ui-messages.ts`.
- No hardcoded user-facing strings in form scripts.

## Styling and accessibility

- Disable Just-validate inline styles: `errorFieldStyle: {}`, `errorLabelStyle: {}`.
- Invalid state → BEM modifier via `errorFieldCssClass` (`text-input--invalid`) and `aria-invalid` set in `onValidate`.
- Render errors in a per-field container (`errorsContainer: '[data-field-error="email"]'`) that has an `id`, is referenced by the input's `aria-describedby`, and has `aria-live="polite"`.
- Form-level feedback goes in a `role="status"` element.
- Disable the submit button while submitting.

## Migration

Each Just-validate rule must map 1:1 to a Zod rule (see `.claude/knowledge/migration-guide.md`). Do not use custom validators that cannot be expressed in Zod without documenting them in the form module.
