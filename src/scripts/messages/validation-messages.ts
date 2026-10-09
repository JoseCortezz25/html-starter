export const CONTACT_FORM_VALIDATION_MESSAGES = {
  name: {
    required: 'Please enter your full name.',
    minLength: (min: number) => `Your name must be at least ${min} characters.`
  },
  email: {
    required: 'Please enter your email address.',
    invalid: 'Please enter a valid email address.'
  },
  message: {
    required: 'Please tell us a little about your project.',
    minLength: (min: number) => `Please write at least ${min} characters.`
  }
} as const;
