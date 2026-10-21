/**
 * GEODEO - System Inżynieryjny B2B i Lokalnego SEO (8 widoków)
 * Obsługa nawigacji mobilnej, formularza wyboru profilu klienta i szybkiego kontaktu
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNavigation();
  initQuickInquiryForm();
  initProfileTriggers();
});

/* 1. Nawigacja mobilna (Drawer) */
function initMobileNavigation() {
  const openBtn = document.querySelector('.mobile-menu-btn');
  const closeBtn = document.querySelector('.mobile-drawer-close');
  const drawer = document.getElementById('mobile-drawer');
  const links = document.querySelectorAll('.mobile-nav-link');

  if (openBtn && drawer) {
    openBtn.addEventListener('click', () => {
      drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  links.forEach(link => {
    link.addEventListener('click', () => {
      if (drawer) {
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });
}

/* 2. Formularz szybkiego zapytania z wyborem profilu klienta */
function initQuickInquiryForm() {
  const form = document.getElementById('geodeo-inquiry-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedProfileInput = form.querySelector('input[name="client_profile"]:checked');
    const profile = selectedProfileInput ? selectedProfileInput.value : 'Właściciel działki / Inwestor indywidualny';
    const name = (form.querySelector('[name="client_name"]')?.value || '').trim();
    const phone = (form.querySelector('[name="client_phone"]')?.value || '').trim();
    const location = (form.querySelector('[name="project_location"]')?.value || '').trim();
    const message = (form.querySelector('[name="project_details"]')?.value || '').trim();

    if (!phone || phone.length < 7) {
      alert('Proszę podać numer telefonu kontaktowego, abyśmy mogli oddzwonić z wyceną.');
      return;
    }

    const pageTitle = document.title;
    const subject = encodeURIComponent(`[Zlecenie / Wycena GEODEO] ${profile} - ${location || 'Podkarpacie'}`);
    const body = encodeURIComponent(
      `Dzień dobry,\n\n` +
      `Przesyłam zapytanie o wycenę i termin prac geodezyjnych:\n` +
      `--------------------------------------------------\n` +
      `• Profil klienta: ${profile}\n` +
      `• Imię / Firma: ${name || 'Nie podano'}\n` +
      `• Telefon kontaktowy: ${phone}\n` +
      `• Lokalizacja (Powiat / Gmina / Obręb / Nr działki): ${location || 'Do ustalenia'}\n` +
      `• Zakres prac / Opis: ${message || 'Proszę o kontakt telefoniczny w celu omówienia szczegółów.'}\n` +
      `--------------------------------------------------\n` +
      `Wysłano ze strony: ${pageTitle}`
    );

    window.location.href = `mailto:geodezja@geodeo.pl?subject=${subject}&body=${body}`;
  });
}

/* 3. Automatyczne zaznaczanie profilu po kliknięciu przycisku CTA */
function initProfileTriggers() {
  const triggers = document.querySelectorAll('[data-select-profile]');
  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetProfile = btn.getAttribute('data-select-profile');
      const radio = document.querySelector(`input[name="client_profile"][value="${targetProfile}"]`);
      if (radio) {
        radio.checked = true;
      }
    });
  });
}
