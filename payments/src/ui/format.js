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
        // Force-convert to IST (UTC+05:30) without relying on Intl timeZone support
        const IST_OFFSET_MINUTES = 5 * 60 + 30; // 330 minutes
        const istMs = d.getTime() + IST_OFFSET_MINUTES * 60 * 1000 - (d.getTimezoneOffset() * 60 * 1000);
        const ist = new Date(istMs);
        const day = String(ist.getUTCDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[ist.getUTCMonth()];
        const year = ist.getUTCFullYear();
        const hour = String(ist.getUTCHours()).padStart(2, '0');
        const minute = String(ist.getUTCMinutes()).padStart(2, '0');
        return `${day}-${month}-${year}, ${hour}:${minute}`;
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
