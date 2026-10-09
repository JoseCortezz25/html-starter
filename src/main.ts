import './styles/main.css';
import { initContactFormAnimation } from './scripts/animations/contact-form-animation';
import { initHeroAnimation } from './scripts/animations/hero-animation';
import { initContactForm } from './scripts/forms/contact-form';

const init = (): void => {
  initHeroAnimation();
  initContactFormAnimation();
  initContactForm();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
