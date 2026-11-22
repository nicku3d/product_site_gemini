// Local event adapter: no persistence, cookies, network requests or production tracking.
const events = [];
const listeners = new Set();
const allowedKeys = new Set(['product', 'location', 'quantity', 'sample', 'bottle', 'stage', 'section', 'code']);
export function track(name, detail = {}) {
  const safeDetail = Object.fromEntries(Object.entries(detail).filter(([key, value]) => allowedKeys.has(key) && (typeof value === 'number' || typeof value === 'string')));
  const event = Object.freeze({ name, detail: Object.freeze(safeDetail), elapsedMs: Math.round(performance.now()) });
  events.push(event);
  if (events.length > 200) events.shift();
  for (const callback of listeners) { try { callback(event); } catch { /* An adapter must never break shopping interactions. */ } }
}
export const analytics = Object.freeze({
  transmissionEnabled: false,
  snapshot: () => events.map(event => ({ ...event, detail: { ...event.detail } })),
  subscribe(callback) {
    if (typeof callback !== 'function') throw new TypeError('Expected callback');
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
});
// Only coarse error codes: no URLs, stacks or user input. No remote monitoring.
window.addEventListener('error', () => track('client_error', { code: 'runtime' }));
window.addEventListener('unhandledrejection', () => track('client_error', { code: 'unhandled_promise' }));
window.obrysAnalytics = analytics;
