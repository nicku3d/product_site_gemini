import { PRODUCTS, MAX_QUANTITY, emptyCart, setQuantity, totals } from './cart-model.js?v=4';
import { track } from './analytics.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = amount => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount);
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
function renderCart(announcement = '') {
  $('#cart-items').hidden = false;
  const t = totals(basket);
  $('#count').textContent = t.count;
  $('#cart-count-label').textContent = t.count ? `, liczba produktów: ${t.count}` : ', pusty';
  $('#checkout').hidden = !t.count;
  $('#checkout').disabled = !t.count;
  $('#cart-items').innerHTML = t.count ? Object.keys(PRODUCTS).filter(key => basket[key]).map(key => `
    <div class="cart-row">
      <div><strong>${PRODUCTS[key].name}</strong><p class="unit-price">${money(PRODUCTS[key].price)} / szt.</p><button class="remove" data-remove="${key}" aria-label="Usuń ${PRODUCTS[key].name}">Usuń produkt</button></div>
      <div class="cart-controls"><div class="quant"><button data-quantity="${key}" data-delta="-1" aria-label="Zmniejsz ilość: ${PRODUCTS[key].name}">−</button><span aria-label="Ilość">${basket[key]}</span><button data-quantity="${key}" data-delta="1" aria-label="Zwiększ ilość: ${PRODUCTS[key].name}" ${basket[key] >= MAX_QUANTITY ? 'disabled' : ''}>+</button></div><p class="row-total"><strong>${money(PRODUCTS[key].price * basket[key])}</strong></p></div>
    </div>`).join('') : '<p class="empty-cart">Twój koszyk jest pusty. Zamknij okno i wybierz próbkę lub flakon.</p>';
  $('#totals').innerHTML = t.count ? `<div class="total-row"><span>Produkty</span><span>${money(t.subtotal)}</span></div><div class="total-row"><span>Dostawa</span><span>${money(t.shipping)}</span></div><div class="total-row"><strong>Razem</strong><strong>${money(t.total)}</strong></div>` : '';
  if (!t.count) $('#checkout-panel').hidden = true;
  $('#cart-status').textContent = announcement ? `${announcement} Liczba produktów: ${t.count}. Razem: ${money(t.total)}.` : '';
}
function openCart(trigger, announcement = '') {
  renderCart(announcement);
  if (!$('#cart').open) openDialog($('#cart'), trigger);
  track('cart_open');
}
$$('[data-add]').forEach(button => button.addEventListener('click', () => {
  const { add: product } = button.dataset;
  const previous = basket[product];
  basket = setQuantity(basket, product, previous + 1);
  resetCheckout();
  $('#order-success').hidden = true;
  $('#order-success').textContent = '';
  openCart(button, basket[product] === previous ? 'Możesz dodać do 20 sztuk tego wariantu.' : `Dodano ${PRODUCTS[product].name}.`);
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
  if (!checkoutStarted || !totals(basket).count) return;
  const items = Object.keys(PRODUCTS).filter(key => basket[key])
    .map(key => PRODUCTS[key].name + ' × ' + basket[key]);
  const success = $('#order-success');
  success.textContent = 'Potwierdzenie zamówienia. ' + items.join(', ') +
    '. Dostawa 0 zł. Razem ' + money(totals(basket).total) + '.';
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
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
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

function selectNote(index, focus = false) {
  $$('[data-note]').forEach((button, i) => {
    button.setAttribute('aria-selected', String(i === index));
    button.tabIndex = i === index ? 0 : -1;
    document.getElementById(`note-${i}`).hidden = i !== index;
    if (i === index && focus) button.focus();
  });
  track('scent_explore', { stage: index });
}
$$('[data-note]').forEach(button => {
  button.addEventListener('click', () => selectNote(Number(button.dataset.note)));
  button.addEventListener('keydown', event => {
    const index = Number(button.dataset.note);
    const next = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 }[event.key];
    if (next === undefined) return;
    event.preventDefault(); selectNote(next, true);
  });
});
$('#hotspot').addEventListener('click', () => {
  const expanded = $('#hotspot').getAttribute('aria-expanded') === 'true';
  $('#hotspot').setAttribute('aria-expanded', String(!expanded));
  $('#hotspot').setAttribute('aria-label', expanded ? 'Pokaż opis zielonej krawędzi' : 'Ukryj opis zielonej krawędzi');
  $('#hotspot').textContent = expanded ? '+' : '−';
  $('#hotspot-note').hidden = expanded;
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
  if (link) {
    setMenu(false);
    const section = document.querySelector(link.getAttribute('href'));
    section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
  }
});
$('.site-header').addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });

const info = {
  concept: ['O marce OBRYS', ['OBRYS łączy zainteresowanie prostą formą z zapachem. KANT przedstawia ten pomysł przez kontrast zielonej mandarynki i suchego drewna.']],
  privacy: ['Prywatność', ['Koszyk działa w pamięci karty. Potwierdzenie znika po zamknięciu koszyka. Nie zapisujemy danych zamówienia ani nie wysyłamy e-maili.', 'GitHub Pages może przetwarzać dane techniczne niezbędne do udostępnienia strony.']]
};
$$('[data-info]').forEach(button => button.addEventListener('click', () => {
  const [title, paragraphs] = info[button.dataset.info];
  $('#info-title').textContent = title;
  $('#info-copy').replaceChildren(...paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
  openDialog($('#info'), button);
}));
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let userReduced = false;
function updateMotion() {
  const reduced = motionQuery.matches || userReduced;
  document.documentElement.classList.toggle('reduced', reduced);
  $('#motion').setAttribute('aria-pressed', String(reduced));
  $('#motion').textContent = motionQuery.matches ? 'Ograniczenie animacji: ustawienie systemowe' : `Ograniczenie animacji: ${reduced ? 'włączone' : 'wyłączone'}`;
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
document.documentElement.classList.add('js');
