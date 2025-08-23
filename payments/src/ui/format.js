// Formatting utilities (currency, dates) shared across screens

export function formatCurrency(value, currency = 'INR') {
    const num = Number(value || 0);
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(num);
    } catch (e) {
        // Fallback simple format
        return `₹${num.toFixed(2)}`;
    }
}

export function formatDate(dateLike) {
    if (!dateLike) return '—';
    try {
        const d = new Date(dateLike);
        if (isNaN(d.getTime())) return dateLike;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateLike;
    }
}

export function formatDateTime(dateLike) {
    if (!dateLike) return '—';
    try {
        const d = new Date(dateLike);
        if (isNaN(d.getTime())) return dateLike;
        return d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return dateLike;
    }
}

export function statusVariant(status) {
    const s = (status || '').toLowerCase();
    switch (s) {
        case 'pending': return 'warning';
        case 'paid':
        case 'success':
        case 'completed': return 'success';
        case 'failed':
        case 'rejected':
        case 'declined': return 'danger';
        case 'processing': return 'info';
        default: return 'neutral';
    }
}
