# Migration Guide: html-starter → Next.js

Prototypes built here are migrated to a Next.js project: Next.js App Router, React, Tailwind v4, Screaming Architecture (`src/domains/<domain>/`) + Atomic Design, React Hook Form + Zod.

The conventions in this starter exist so that migration is mostly **moving files and renaming**, not redesigning.

## Mapping Contract

| html-starter                                           | Next.js                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `data-component="organism/hero"`                       | `src/domains/<domain>/components/organisms/hero.tsx`                                  |
| `data-component="atom/button"` (shared across domains) | `src/components/atoms/button.tsx`                                                     |
| `src/styles/components/<level>/<name>.css`             | same path in Next `src/styles/components/` (1:1), imported from `src/styles/main.css` |
| `@theme { }` tokens in `src/styles/main.css`           | `@theme inline { }` in `src/app/globals.css`                                          |
| Just-validate rules in `src/scripts/forms/*`           | Zod schema (`<form-name>.schema.ts`) + React Hook Form                                |
| `src/scripts/messages/validation-messages.ts`          | domain `validation-messages.ts`                                                       |
| `src/scripts/messages/ui-messages.ts`                  | domain `messages.ts`                                                                  |
| GSAP module in `src/scripts/animations/*`              | `useGSAP` hook inside the component                                                   |
| `data-*` script hooks (`data-hero-item`)               | `ref`s / `useGSAP({ scope })` selectors                                               |
| Form submit handler in `onSuccess`                     | `use-<form-name>-submit.ts` hook + Server Action                                      |
| One HTML page (`index.html`)                           | `src/app/<route>/page.tsx` composing organisms                                        |

Rules of thumb:

- BEM class names do not change. `class` becomes `className`; the CSS file is copied as-is.
- Component name = `data-component` name = CSS file name = React file name.
- Every Just-validate rule has a Zod equivalent; numeric limits are named constants and move with the schema.
- Messages keep their keys; only the file location changes.

## Step-by-step example

Migrating the example landing (`index.html`) into a `marketing` domain.

### 1. Tokens and styles

1. Copy each `--*` variable from the `@theme` block in `src/styles/main.css` into `@theme inline { }` in Next `src/app/globals.css` (skip names that already exist).
2. Copy `src/styles/components/**` into Next `src/styles/components/**` and add the same `@import` lines to Next `src/styles/main.css`.

### 2. Hero organism + GSAP → React component with `useGSAP`

Before (`src/scripts/animations/hero-animation.ts`):

```ts
mm.add(
  MOTION_CONDITIONS,
  context => {
    const { canAnimate } = context.conditions ?? {};
    if (!canAnimate) return;
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .from(items, { autoAlpha: 0, y: 32, duration: 0.9, stagger: 0.12 });
  },
  hero
);
```

After (`src/domains/marketing/components/organisms/hero.tsx`):

```tsx
'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOTION_CONDITIONS } from '@/lib/gsap';
import { Button } from '@/components/atoms/button';
import { MARKETING_MESSAGES } from '../../messages';

gsap.registerPlugin(useGSAP);

export function Hero() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_CONDITIONS, context => {
        const { canAnimate } = context.conditions ?? {};
        if (!canAnimate) return;
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('[data-hero-item]', {
            autoAlpha: 0,
            y: 32,
            duration: 0.9,
            stagger: 0.12
          });
      });
    },
    { scope }
  );

  return (
    <section ref={scope} className="hero" aria-labelledby="hero-title">
      <div className="hero__inner">
        <div className="hero__content">
          <p className="hero__eyebrow" data-hero-item>
            {MARKETING_MESSAGES.hero.eyebrow}
          </p>
          <h1 className="hero__title" id="hero-title" data-hero-item>
            {MARKETING_MESSAGES.hero.title}
          </h1>
          {/* ...rest of the markup, same BEM classes */}
        </div>
      </div>
    </section>
  );
}
```

Notes:

- `useGSAP` reverts everything created inside it on unmount, so the `() => mm.revert()` cleanup is no longer needed.
- `data-component` attributes can be dropped after migration; they were the mapping key.
- Hardcoded HTML copy moves into the domain `messages.ts`.

### 3. Contact form + Just-validate → Zod + React Hook Form

Before (`src/scripts/forms/contact-form.ts`):

```ts
.addField('[name="email"]', [
  { rule: Rules.Required, errorMessage: messages.email.required },
  { rule: Rules.Email, errorMessage: messages.email.invalid }
])
```

After (`src/domains/marketing/schemas/contact-form.schema.ts`):

```ts
import { z } from 'zod';
import { CONTACT_FORM_VALIDATION_MESSAGES as messages } from '../validation-messages';

const NAME_MIN_LENGTH = 2;
const MESSAGE_MIN_LENGTH = 20;

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, messages.name.required)
    .min(NAME_MIN_LENGTH, messages.name.minLength(NAME_MIN_LENGTH)),
  email: z
    .string()
    .trim()
    .min(1, messages.email.required)
    .pipe(z.email(messages.email.invalid)),
  message: z
    .string()
    .trim()
    .min(1, messages.message.required)
    .min(MESSAGE_MIN_LENGTH, messages.message.minLength(MESSAGE_MIN_LENGTH))
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
```

Rule mapping:

| Just-validate                         | Zod                             |
| ------------------------------------- | ------------------------------- |
| `Rules.Required`                      | `.min(1, msg)` (strings)        |
| `Rules.Email`                         | `z.email(msg)`                  |
| `Rules.MinLength` / `Rules.MaxLength` | `.min(n, msg)` / `.max(n, msg)` |
| `Rules.Number` / `Rules.Integer`      | `z.coerce.number()` / `.int()`  |
| `Rules.CustomRegexp`                  | `.regex(pattern, msg)`          |
| custom `validator`                    | `.refine(fn, msg)`              |

Then, in the Next.js project:

1. Move `validation-messages.ts` to `src/domains/marketing/validation-messages.ts` unchanged.
2. Create `src/domains/marketing/hooks/use-contact-form-submit.ts` with `useForm<ContactFormInput>({ resolver: zodResolver(contactFormSchema) })`; the `onSuccess` body becomes the submit handler (Server Action call instead of the simulated request).
3. Create `src/domains/marketing/components/organisms/contact-form.tsx`, keep the BEM classes, map `form-field__error` to `errors.<field>?.message`, and disable the button with `isSubmitting`.
4. `aria-invalid` and `aria-describedby` stay exactly as in the HTML.

### 4. Page

Compose the organisms in `src/app/(marketing)/page.tsx` in the same order as `index.html`. Header and footer, duplicated across HTML pages here, become a shared layout.

## Checklist

- [ ] Every `data-component` has a matching `.tsx` file in the right level folder.
- [ ] Every component CSS file is copied 1:1 and imported.
- [ ] Every `@theme` token exists in `globals.css`.
- [ ] Every Just-validate rule has a Zod rule with the same message.
- [ ] Every GSAP module became a `useGSAP` call inside its component and still honors reduced motion.
- [ ] No hardcoded strings remain in components.

Use the `migration-auditor` agent to verify the prototype is migration-ready before handing it off.
