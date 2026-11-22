export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_COST = 12;

export const PRODUCTS = Object.freeze({
  sample: Object.freeze({
    name: 'KANT · próbka 2 ml',
    price: 19,
    fulfillment: 'Wysyłka w 24–48 h · voucher −19 zł na flakon (30 dni)'
  }),
  bottle: Object.freeze({
    name: 'KANT · flakon 50 ml',
    price: 249,
    fulfillment: 'Przedsprzedaż · wysyłka od 03.2027 · darmowa dostawa'
  })
});

export const MAX_QUANTITY = 20;
export const emptyCart = () => ({ sample: 0, bottle: 0 });

export function setQuantity(cart, product, quantity) {
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, product) || !Number.isInteger(quantity)) return { ...cart };
  return { ...cart, [product]: Math.max(0, Math.min(MAX_QUANTITY, quantity)) };
}

export function totals(cart) {
  const count = Object.keys(PRODUCTS).reduce((sum, key) => sum + cart[key], 0);
  const subtotal = Object.keys(PRODUCTS).reduce((sum, key) => sum + cart[key] * PRODUCTS[key].price, 0);
  const shipping = count === 0 ? 0 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST);
  const freeShippingRemaining = count === 0 ? FREE_SHIPPING_THRESHOLD : Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  return { count, subtotal, shipping, total: subtotal + shipping, freeShippingRemaining };
}
