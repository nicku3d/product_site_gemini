export const PRODUCTS = Object.freeze({
  sample: Object.freeze({ name: 'KANT · próbka 2 ml', price: 19 }),
  bottle: Object.freeze({ name: 'KANT · flakon 50 ml', price: 249 })
});
export const MAX_QUANTITY = 20;
export const emptyCart = () => ({ sample: 0, bottle: 0 });
export function setQuantity(cart, product, quantity) {
  if (!Object.hasOwn(PRODUCTS, product) || !Number.isInteger(quantity)) return { ...cart };
  return { ...cart, [product]: Math.max(0, Math.min(MAX_QUANTITY, quantity)) };
}
export function totals(cart) {
  const count = Object.keys(PRODUCTS).reduce((sum, key) => sum + cart[key], 0);
  const subtotal = Object.keys(PRODUCTS).reduce((sum, key) => sum + cart[key] * PRODUCTS[key].price, 0);
  const shipping = 0;
  return { count, subtotal, shipping, total: subtotal + shipping };
}
