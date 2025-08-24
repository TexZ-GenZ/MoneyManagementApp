// Simple event emitter for payment updates
// Allows list screens to react instantly when a payment is approved/declined in the detail view.
const listeners = new Set();

export function onPaymentUpdate(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emitPaymentUpdate(payload) { for (const fn of Array.from(listeners)) { try { fn(payload); } catch (e) { /* noop */ } } }
