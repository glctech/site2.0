const defaultLang = 'pt';

async function loadLanguage(lang) {

  const response = await fetch(`/lang/${lang}.json`);
  const translations = await response.json();

  document.querySelectorAll('[data-i18n]').forEach(el => {

    const key = el.dataset.i18n;

    if (translations[key]) {
      el.innerHTML = translations[key];
    }

  });

  localStorage.setItem('lang', lang);
}

function detectLanguage() {

  const saved = localStorage.getItem('lang');

  if (saved) return saved;

  const browser = navigator.language.toLowerCase();

  if (browser.startsWith('pt')) return 'pt';
  if (browser.startsWith('es')) return 'es';

  return 'en';
}

loadLanguage(detectLanguage());
