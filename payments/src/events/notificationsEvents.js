// Simple event emitter for notifications badge changes
const listeners = new Set();

export function onBadgeChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export function emitBadgeChange() {
    listeners.forEach(cb => {
        try { cb(); } catch (_) { }
    });
}
