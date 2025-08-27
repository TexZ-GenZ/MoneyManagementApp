import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ExpoNotifications from 'expo-notifications';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { StorageService } from '../../src/services/storageService';
import { getApiUrl } from '../../src/utils/config';
import { emitBadgeChange } from '../../src/events/notificationsEvents';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime } from '../../src/ui/format';

export default function Notifications() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [skip, setSkip] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 40;
    const loadingMoreRef = useRef(false);
    const skipRef = useRef(0);

    const fetchNotifs = useCallback(async (opts = { append: false }) => {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        if (!opts.append) {
            setLoading(true); setError(null); setHasMore(true); setSkip(0); skipRef.current = 0;
        }
        try {
            const token = await StorageService.getToken();
            const useSkip = opts.append ? skipRef.current : 0;
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` };
            // Delivered-only endpoint
            const resp = await fetch(`${getApiUrl('/notifications/delivered')}?since_hours=24&limit=${pageSize}&skip=${useSkip}&_t=${Date.now()}`, { headers });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !Array.isArray(data?.items)) {
                throw new Error((data && data.detail) || 'Failed to load');
            }
            const newItems = Array.isArray(data?.items) ? data.items : [];
            setItems(prev => opts.append ? [...prev, ...newItems] : newItems);
            const nextSkip = typeof data?.next_skip === 'number' ? data.next_skip : (useSkip + newItems.length);
            setSkip(nextSkip);
            skipRef.current = nextSkip;
            setHasMore(newItems.length >= pageSize);
            // Auto-acknowledge any newly loaded, unacknowledged delivered items
            const toAck = (newItems || []).filter(x => x && !x.acknowledged).map(x => x.id);
            if (toAck.length) {
                // Fire-and-forget individual ack calls; no need to block UI
                toAck.forEach(async (id) => {
                    try {
                        await ackDelivered(id);
                    } catch (_) { }
                });
            }
        } catch (e) {
            setError(e.message || 'Load failed');
            if (!opts.append) setItems([]);
        } finally {
            loadingMoreRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifs({ append: false }); }, []);

    // When this screen gains focus, clear any OS-level notifications so the launcher dot disappears
    useFocusEffect(
        useCallback(() => {
            ExpoNotifications.dismissAllNotificationsAsync().catch(() => { });
        }, [])
    );


    const ackDelivered = async (id) => {
        try {
            const token = await StorageService.getToken();
            const r = await fetch(`${getApiUrl('/notifications/delivered')}/${id}/ack`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` } });
            if (r.ok) {
                setItems(prev => prev.map(it => it.id === id ? { ...it, acknowledged: true } : it));
                try { emitBadgeChange(); } catch (_) { }
            }
        } catch (_) { }
    };

    // Include delivered items in unread count (acknowledged=false)
    const deliveredUnread = useMemo(() => items.filter(n => n && n.title && n.body && !n.acknowledged).length, [items]);
    const totalUnread = deliveredUnread || 0;

    const renderItem = ({ item }) => {
        // If delivered item shape (title/body)
        if (item.title && item.body) {
            const createdLabel = formatDateTime(item.created_at || item.createdAt);

            const isAck = !!item.acknowledged;
            return (
                <Card style={styles.itemCard}>
                    <View style={styles.itemHeaderRow}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="notifications-outline" size={18} color={tokens.colors.accent} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.itemTitle} numberOfLines={2}>{String(item.title)}</Text>
                        </View>
                        {!isAck && (
                            <View style={styles.unreadPill}><Text style={styles.unreadText}>UNREAD</Text></View>
                        )}
                    </View>
                    <Text style={[styles.itemLine]} numberOfLines={4}>{String(item.body)}</Text>
                    <View style={styles.footerRow}>
                        <Text style={styles.createdAt} numberOfLines={1} ellipsizeMode="tail">{createdLabel}</Text>
                        {!isAck && (
                            <TouchableOpacity style={styles.ackBtn} onPress={() => ackDelivered(item.id)}>
                                <Text style={styles.ackText}>Mark read</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Card>
            );
        }
        // Legacy/aggregated items are removed; only delivered items are rendered.
        return null;
    };

    return (
        <Screen title="Notifications" subtitle={totalUnread > 0 ? `${totalUnread} unread` : undefined}>
            {loading ? (
                <View style={styles.loading}><ActivityIndicator color={tokens.colors.accent} /></View>
            ) : error ? (
                <Text style={styles.error}>{error}</Text>
            ) : items.length === 0 ? (
                <Text style={styles.empty}>No notifications in the last 24 hours.</Text>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(it) => String(it.id)}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchNotifs({ append: false })} tintColor={tokens.colors.accent} />}
                    onEndReachedThreshold={0.6}
                    onEndReached={() => { if (!loading && hasMore) fetchNotifs({ append: true }); }}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    ListFooterComponent={!hasMore ? null : (
                        <View style={{ paddingVertical: 12 }}>
                            <ActivityIndicator color={tokens.colors.accent} />
                        </View>
                    )}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    itemCard: { paddingVertical: 12, paddingHorizontal: 12 },
    itemHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    iconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: tokens.colors.cardAlt, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: tokens.colors.border },
    itemTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '800' },
    itemCompany: { color: tokens.colors.textDim, fontSize: 12, marginTop: 2 },
    itemLine: { color: tokens.colors.text, fontSize: 13, marginTop: 6 },
    itemStatus: { fontSize: 12, marginTop: 6, fontWeight: '700' },
    itemStatusDanger: { color: tokens.colors.danger },
    itemStatusAccent: { color: tokens.colors.accent },
    itemStatusNeutral: { color: tokens.colors.textDim },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    createdAt: { color: tokens.colors.textDim, fontSize: 11, flex: 1 },
    unreadPill: { backgroundColor: tokens.colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#000' },
    unreadText: { color: '#000', fontSize: 10, fontWeight: '800' },
    ackBtn: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
    ackText: { color: tokens.colors.text, fontSize: 12, fontWeight: '700' },
    loading: { paddingVertical: 20 },
    error: { color: tokens.colors.danger, marginTop: 16 },
    empty: { color: tokens.colors.textDim, marginTop: 16 },
});
