import JustValidate, { Rules } from 'just-validate';
import { CONTACT_FORM_UI_MESSAGES } from '../messages/ui-messages';
import { CONTACT_FORM_VALIDATION_MESSAGES } from '../messages/validation-messages';
import { queryRequired } from '../utils/dom';

const NAME_MIN_LENGTH = 2;
const MESSAGE_MIN_LENGTH = 20;
const SIMULATED_REQUEST_MS = 800;

const STATUS_MODIFIERS = {
  success: 'contact-form__status--success',
  error: 'contact-form__status--error'
} as const;

type FormStatus = keyof typeof STATUS_MODIFIERS;

const setStatus = (
  statusElement: HTMLElement,
  status: FormStatus | null,
  text = ''
): void => {
  statusElement.classList.remove(...Object.values(STATUS_MODIFIERS));
  if (status) statusElement.classList.add(STATUS_MODIFIERS[status]);
  statusElement.textContent = text;
};

const simulateRequest = (): Promise<void> =>
  new Promise(resolve => {
    window.setTimeout(resolve, SIMULATED_REQUEST_MS);
  });

export const initContactForm = (): JustValidate | null => {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return null;

  const submitButton = queryRequired<HTMLButtonElement>(
    form,
    '[data-form-submit]'
  );
  const statusElement = queryRequired(form, '[data-form-status]');
  const messages = CONTACT_FORM_VALIDATION_MESSAGES;

  const validator = new JustValidate(form, {
    errorFieldCssClass: 'text-input--invalid',
    errorFieldStyle: {},
    errorLabelStyle: {},
    errorLabelCssClass: [],
    successFieldCssClass: [],
    focusInvalidField: true,
    validateBeforeSubmitting: false
  });

  validator
    .addField(
      '[name="name"]',
      [
        { rule: Rules.Required, errorMessage: messages.name.required },
        {
          rule: Rules.MinLength,
          value: NAME_MIN_LENGTH,
          errorMessage: messages.name.minLength(NAME_MIN_LENGTH)
        }
      ],
      { errorsContainer: '[data-field-error="name"]' }
    )
    .addField(
      '[name="email"]',
      [
        { rule: Rules.Required, errorMessage: messages.email.required },
        { rule: Rules.Email, errorMessage: messages.email.invalid }
      ],
      { errorsContainer: '[data-field-error="email"]' }
    )
    .addField(
      '[name="message"]',
      [
        { rule: Rules.Required, errorMessage: messages.message.required },
        {
          rule: Rules.MinLength,
          value: MESSAGE_MIN_LENGTH,
          errorMessage: messages.message.minLength(MESSAGE_MIN_LENGTH)
        }
      ],
      { errorsContainer: '[data-field-error="message"]' }
    )
    .onValidate(({ fields }) => {
      Object.values(fields).forEach(field => {
        field.elem.setAttribute(
          'aria-invalid',
          String(field.isValid === false)
        );
      });
    })
    .onFail(() => {
      setStatus(statusElement, 'error', CONTACT_FORM_UI_MESSAGES.error);
    })
    .onSuccess(async () => {
      submitButton.disabled = true;
      submitButton.textContent = CONTACT_FORM_UI_MESSAGES.submitting;
      setStatus(statusElement, null);

      await simulateRequest();

      form.reset();
      validator.refresh();
      submitButton.disabled = false;
      submitButton.textContent = CONTACT_FORM_UI_MESSAGES.submit;
      setStatus(statusElement, 'success', CONTACT_FORM_UI_MESSAGES.success);
    });

  return validator;
};
