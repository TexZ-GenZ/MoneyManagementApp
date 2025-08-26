import { useEffect, useState, useCallback } from 'react';
import { StorageService } from '../../services/storageService';
import { API_BASE_URL } from '../../utils/constants';

export function useNotificationsBadge() {
    const [unread, setUnread] = useState(0);

    const refreshUnread = useCallback(async () => {
        try {
            const token = await StorageService.getToken();
            const base = API_BASE_URL;
            // Use lightweight count endpoint
            const r = await fetch(`${base}/notifications/unread-count?since_hours=24&_t=${Date.now()}`, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` },
            });
            if (!r.ok) { setUnread(0); return; }
            const data = await r.json();
            setUnread(typeof data?.unread === 'number' ? data.unread : 0);
        } catch (_) {
            setUnread(0);
        }
    }, []);

    useEffect(() => {
        refreshUnread();
        const id = setInterval(refreshUnread, 30000);
        return () => clearInterval(id);
    }, [refreshUnread]);

    return { unread, refreshUnread };
}
