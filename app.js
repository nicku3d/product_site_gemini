import {
  PRODUCTS,
  MAX_QUANTITY,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  emptyCart,
  setQuantity,
  totals
} from './cart-model.js?v=6';
import { track } from './analytics.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = amount => new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0
}).format(amount);

let basket = emptyCart();
let checkoutStarted = false;
const returnFocus = new WeakMap();

function openDialog(dialog, trigger) {
  returnFocus.set(dialog, trigger || document.activeElement);
  dialog.showModal();
  document.body.classList.add('modal-open');
  dialog.querySelector('[autofocus]')?.focus();
}

function resetCheckout() {
  $('#checkout-panel').hidden = true;
  checkoutStarted = false;
}

function deliveryNote(cart, t) {
  if (!t.count) {
    return `Próbka 2 ml: wysyłka w 24–48 h (InPost / kurier ${money(SHIPPING_COST)}) + voucher −19 zł. Flakon 50 ml: premiera 21.03.2027, 10:00, darmowa dostawa od ${money(FREE_SHIPPING_THRESHOLD)}.`;
  }
  if (cart.bottle && cart.sample) {
    return 'Darmowa dostawa (próg 200 zł osiągnięty). Próbkę 2 ml wyślemy w 24–48 h, a flakon 50 ml w terminie premiery (21 marca 2027 r., godz. 10:00).';
  }
  if (cart.bottle) {
    return 'Darmowa dostawa InPost Paczkomat lub kurierem. Premiera flakonu 50 ml: 21 marca 2027 r., godz. 10:00 czasu polskiego.';
  }
  if (t.shipping === 0) {
    return 'Darmowa dostawa (próg 200 zł osiągnięty). Próbki wysyłamy w 24–48 h; do zamówienia dołączamy voucher −19 zł na flakon 50 ml.';
  }
  return `Dostawa InPost Paczkomat / kurier: ${money(t.shipping)} (darmowa od ${money(FREE_SHIPPING_THRESHOLD)}). Do próbki dołączamy voucher −19 zł na pełny flakon, ważny 30 dni.`;
}

function renderCart(announcement = '') {
  $('#cart-items').hidden = false;
  const t = totals(basket);
  $('#count').textContent = t.count;
  $('#cart-count-label').textContent = t.count ? `, liczba produktów: ${t.count}` : ', pusty';
  $('#cart-delivery').textContent = deliveryNote(basket, t);
  $('#checkout').hidden = !t.count;
  $('#checkout').disabled = !t.count;
  $('#cart-items').innerHTML = t.count ? Object.keys(PRODUCTS).filter(key => basket[key]).map(key => `
    <div class="cart-row">
      <div>
        <strong>${PRODUCTS[key].name}</strong>
        <p class="unit-price">${money(PRODUCTS[key].price)} / szt.</p>
        <p class="item-fulfillment">${PRODUCTS[key].fulfillment}</p>
        <button class="remove" data-remove="${key}" aria-label="Usuń ${PRODUCTS[key].name}">Usuń produkt</button>
      </div>
      <div class="cart-controls">
        <div class="quant">
          <button data-quantity="${key}" data-delta="-1" aria-label="Zmniejsz ilość: ${PRODUCTS[key].name}">−</button>
          <span aria-label="Ilość">${basket[key]}</span>
          <button data-quantity="${key}" data-delta="1" aria-label="Zwiększ ilość: ${PRODUCTS[key].name}" ${basket[key] >= MAX_QUANTITY ? 'disabled' : ''}>+</button>
        </div>
        <p class="row-total"><strong>${money(PRODUCTS[key].price * basket[key])}</strong></p>
      </div>
    </div>`).join('') : '<p class="empty-cart">Twój koszyk jest pusty. Zamknij okno i wybierz próbkę 2 ml lub flakon 50 ml.</p>';
  $('#totals').innerHTML = t.count ? `
    <div class="total-row"><span>Produkty</span><span>${money(t.subtotal)}</span></div>
    <div class="total-row"><span>Dostawa (InPost / kurier)</span><span>${t.shipping === 0 ? '0 zł' : money(t.shipping)}</span></div>
    <div class="total-row"><strong>Razem</strong><strong>${money(t.total)}</strong></div>` : '';
  if (!t.count) $('#checkout-panel').hidden = true;
  $('#cart-status').textContent = announcement ? `${announcement} Liczba produktów: ${t.count}. Razem: ${money(t.total)}.` : '';
}

function openCart(trigger, announcement = '') {
  renderCart(announcement);
  if (!$('#cart').open) openDialog($('#cart'), trigger);
  track('cart_open');
}

$$('[data-add]').forEach(button => button.addEventListener('click', () => {
  const { add: product, location } = button.dataset;
  const previous = basket[product];
  basket = setQuantity(basket, product, previous + 1);
  resetCheckout();
  $('#order-success').hidden = true;
  $('#order-success').textContent = '';
  track('add_to_cart', { product, location: location || 'page', quantity: basket[product] });
  openCart(button, basket[product] === previous ? `Możesz dodać do ${MAX_QUANTITY} sztuk tego wariantu.` : `Dodano ${PRODUCTS[product].name}.`);
}));

$('#open-cart').addEventListener('click', event => openCart(event.currentTarget));

$('#cart-items').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const product = button.dataset.remove || button.dataset.quantity;
  if (!product) return;
  const next = button.dataset.remove ? 0 : basket[product] + Number(button.dataset.delta);
  basket = setQuantity(basket, product, next);
  resetCheckout();
  renderCart(basket[product] ? `Zmieniono ilość: ${PRODUCTS[product].name}.` : `Usunięto ${PRODUCTS[product].name}.`);
  const same = button.dataset.quantity ? $(`[data-quantity="${product}"][data-delta="${button.dataset.delta}"]`) : null;
  const fallback = $(`[data-quantity="${product}"][data-delta="-1"]`) || $('#cart-items button') || $('#cart .close');
  (same && !same.disabled ? same : fallback).focus();
});

$('#checkout').addEventListener('click', () => {
  if (!totals(basket).count) return;
  $('#checkout-panel').hidden = false;
  $('#checkout-title').focus();
  checkoutStarted = true;
});

$('#place-order').addEventListener('click', () => {
  const t = totals(basket);
  if (!checkoutStarted || !t.count) return;
  const hadBottle = basket.bottle > 0;
  const hadSample = basket.sample > 0;
  const items = Object.keys(PRODUCTS).filter(key => basket[key])
    .map(key => `${PRODUCTS[key].name} × ${basket[key]}`);
  const shippingText = t.shipping === 0 ? 'Dostawa 0 zł.' : `Dostawa ${money(t.shipping)}.`;
  const timingText = hadBottle && hadSample
    ? 'Próbkę wyślemy w 24–48 h, flakon 50 ml w terminie premiery (21.03.2027, godz. 10:00).'
    : hadBottle
      ? 'Rezerwacja na premierę 21 marca 2027 r., godz. 10:00.'
      : 'Wysyłka w 24–48 h wraz z voucherem −19 zł na pełny flakon.';
  const success = $('#order-success');
  success.textContent = `Potwierdzenie zamówienia: ${items.join(', ')}. ${shippingText} Razem ${money(t.total)}. ${timingText}`;
  basket = emptyCart();
  resetCheckout();
  renderCart();
  $('#cart-items').hidden = true;
  success.hidden = false;
  success.focus();
});

// Native dialog supplies modal semantics, Escape and inert background; explicit return and Tab wrap cover focus edges.
$$('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));

$$('dialog').forEach(dialog => {
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(node => !node.closest('[hidden]'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.id === 'cart') {
      $('#order-success').textContent = '';
      $('#order-success').hidden = true;
      resetCheckout();
    }
    document.body.classList.remove('modal-open');
    const trigger = returnFocus.get(dialog);
    if (trigger?.isConnected) trigger.focus();
  });
});

const menu = $('#menu-toggle');
function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.querySelector('span').textContent = open ? '−' : '+';
  $('#main-nav').classList.toggle('is-open', open);
}
menu.hidden = false;
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));

$('#main-nav').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  setMenu(false);
  const section = document.querySelector(link.getAttribute('href'));
  if (section) {
    section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
  }
});

$('.site-header').addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});

const info = {
  terms: [
    'Regulamin sprzedaży',
    [
      'Sprzedawcą jest OBRYS Studio sp. z o.o., ul. Przykładowa 12, 00-001 Warszawa (perfumyobrys.pl, kontakt: kontakt@perfumyobrys.pl).',
      'Flakon KANT 50 ml oferowany jest na premierę 21 marca 2027 r. o godz. 10:00 czasu polskiego. Próbka 2 ml dostępna jest w wysyłce bieżącej w ciągu 24–48 godzin roboczych.',
      'Dostawa realizowana jest przez InPost Paczkomat lub kuriera: 0 zł dla zamówień od 200 zł oraz 12 zł dla zamówień poniżej progu. Obsługiwane płatności: BLIK, karta płatnicza oraz Przelewy24.',
      'Voucher −19 zł dołączony do próbki 2 ml jest jednorazowy, dotyczy zakupu flakonu 50 ml i zachowuje ważność przez 30 dni od daty zakupu próbki.'
    ]
  ],
  privacy: [
    'Polityka prywatności',
    [
      'Administrator danych: OBRYS Studio sp. z o.o., ul. Przykładowa 12, 00-001 Warszawa. Kontakt w sprawach prywatności: kontakt@perfumyobrys.pl. Adres polityki: https://perfumyobrys.pl/polityka-prywatnosci.',
      'Cele i podstawy przetwarzania: dane przetwarzamy w celu realizacji zamówień i obsługi umowy (art. 6 ust. 1 lit. b RODO), wykonania obowiązków prawnych (art. 6 ust. 1 lit. c RODO), prowadzenia korespondencji i ochrony roszczeń (art. 6 ust. 1 lit. f RODO) oraz — po uzyskaniu zgody — wysyłania newslettera (art. 6 ust. 1 lit. a RODO).',
      'Odbiorcy i okres przechowywania: odbiorcami mogą być dostawcy hostingu, płatności, dostaw, księgowości i poczty. Dane zamówień przechowujemy przez okres realizacji umowy oraz wymagany przepisami i ochroną roszczeń, dane newslettera do wycofania zgody, a dane korespondencji przez okres potrzebny do obsługi sprawy.',
      'Twoje prawa i dobrowolność: przysługuje Ci dostęp do danych, ich sprostowanie, usunięcie, ograniczenie przetwarzania, przenoszenie danych, sprzeciw, wycofanie zgody w dowolnym momencie oraz prawo skargi do Prezesa Urzędu Ochrony Danych Osobowych. Podanie danych jest dobrowolne, lecz niezbędne do realizacji zamówienia lub subskrypcji newslettera.',
      'Cookies i automatyczne decyzje: strona nie wykorzystuje cookies śledzących ani zautomatyzowanego profilowania; koszyk działa lokalnie w pamięci przeglądarki.'
    ]
  ],
  returns: [
    'Zwroty i reklamacje',
    [
      'Konsument ma 14 dni kalendarzowych od daty odbioru przesyłki na odstąpienie od umowy bez podawania przyczyny.',
      'Zwrot dotyczy produktów nieotwartych, w fabrycznie zapieczętowanym opakowaniu. Ze względów higienicznych (art. 38 pkt 5 ustawy o prawach konsumenta) prawo odstąpienia nie przysługuje w przypadku produktów rozpieczętowanych po dostarczeniu.',
      'Reklamacje dotyczące uszkodzeń w transporcie lub wad produktu rozpatrujemy w ciągu 14 dni. Zgłoszenia i formularz zwrotu: kontakt@perfumyobrys.pl · adres do zwrotów: OBRYS Studio sp. z o.o., ul. Przykładowa 12, 00-001 Warszawa.'
    ]
  ],
  contact: [
    'Kontakt',
    [
      'Obsługa klienta i sprawy dotyczące danych osobowych: kontakt@perfumyobrys.pl (odpowiadamy w dni robocze w 24 h).',
      'Sklep i dane podmiotu: perfumyobrys.pl · OBRYS Studio sp. z o.o., ul. Przykładowa 12, 00-001 Warszawa.',
      'Social media: Instagram @obrys.perfumy · TikTok @obrys.perfumy.'
    ]
  ]
};

$$('[data-info]').forEach(button => button.addEventListener('click', () => {
  const entry = info[button.dataset.info];
  if (!entry) return;
  const [title, paragraphs] = entry;
  $('#info-title').textContent = title;
  $('#info-copy').replaceChildren(...paragraphs.map(text => {
    const p = document.createElement('p');
    p.textContent = text;
    return p;
  }));
  openDialog($('#info'), button);
}));

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let userReduced = false;
function updateMotion() {
  const reduced = motionQuery.matches || userReduced;
  document.documentElement.classList.toggle('reduced', reduced);
  $('#motion').setAttribute('aria-pressed', String(reduced));
  $('#motion').textContent = motionQuery.matches
    ? 'Ograniczenie animacji: ustawienie systemowe'
    : `Ograniczenie animacji: ${reduced ? 'włączone' : 'wyłączone'}`;
  $('#motion').disabled = motionQuery.matches;
}
$('#motion').addEventListener('click', () => { userReduced = !userReduced; updateMotion(); });
motionQuery.addEventListener?.('change', updateMotion);
updateMotion();

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('seen');
      track('section_view', { section: entry.target.closest('section')?.id || 'hero' });
      observer.unobserve(entry.target);
    }
  }), { threshold: .15 });
  $$('.section-heading').forEach(heading => observer.observe(heading));
}

const newsletterForm = $('#newsletter-form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', async event => {
    event.preventDefault();
    const emailInput = $('#newsletter-email');
    const consentInput = $('#newsletter-consent');
    const errorBox = $('#newsletter-error');
    const statusBox = $('#newsletter-status');
    const submitBtn = newsletterForm.querySelector('button[type="submit"]');

    errorBox.textContent = '';
    statusBox.hidden = true;
    statusBox.textContent = '';

    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      errorBox.textContent = 'Wpisz poprawny adres e-mail.';
      emailInput.focus();
      return;
    }
    if (!consentInput.checked) {
      errorBox.textContent = 'Zaznacz zgodę na otrzymywanie newslettera OBRYS.';
      consentInput.focus();
      return;
    }

    const payload = {
      email,
      consent: true,
      consentDate: new Date().toISOString(),
      consentVersion: '2026-11-v1'
    };

    submitBtn.disabled = true;
    try {
      await fetch(newsletterForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      // Endpoint on perfumyobrys.pl may not be live yet in static preview mode.
    } finally {
      submitBtn.disabled = false;
    }

    statusBox.textContent = 'Sprawdź skrzynkę i potwierdź zapis do newslettera OBRYS.';
    statusBox.hidden = false;
    newsletterForm.reset();
    track('newsletter_submit');
  });
}

document.documentElement.classList.add('js');
