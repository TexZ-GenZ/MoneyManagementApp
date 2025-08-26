import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { API_BASE_URL } from '../../src/utils/constants';
import { formatDateTime, formatCurrency } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from '../../src/ui/components/StatusBadge';
import { onPaymentUpdate } from '../../src/events/paymentEvents';
import { useAppSelector } from '../../src/store/hooks';

// Use central API base configured via EXPO_PUBLIC_API_BASE_URL

export default function UnifiedHistory() {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | pending | approved | declined
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const debounceRef = useRef(null);
    const router = useRouter();
    const userRole = useAppSelector(s => s.auth.user?.role || 'accountant');

    const fetchData = useCallback(async (q, status = statusFilter) => {
        setLoading(true);
        try {
            const tok = await StorageService.getToken();
            const url = new URL(`${API_BASE_URL}/payments/activity`);
            url.searchParams.set('limit', '100');
            if (q) url.searchParams.set('search', q);
            // Optionally filter by status client-side after fetch
            const r = await fetch(url.toString(), {
                headers: {
                    'Content-Type': 'application/json',
                    ...(tok ? { Authorization: `Bearer ${tok.access_token}` } : {})
                }
            });
            if (!r.ok) {
                console.log('API Error:', r.status, await r.text());
                throw new Error('Failed');
            }
            const data = await r.json();
            let arr = Array.isArray(data.items) ? data.items : [];
            // client-side status filter for now
            if (status && status !== 'all') {
                arr = arr.filter((it) => {
                    const s = (it.status || '').toLowerCase();
                    if (status === 'pending') return s === 'submitted' || s === 'accountant_approved';
                    if (status === 'approved') return s === 'admin_approved';
                    if (status === 'declined') return s.includes('declined');
                    return true;
                });
            }
            // Time parser first (used below)
            const toMillis = (v) => {
                if (v == null) return 0;
                if (typeof v === 'number') {
                    // seconds vs ms
                    return v > 1e12 ? v : (v > 1e9 ? v * 1000 : v);
                }
                if (typeof v === 'string') {
                    let s = v.trim();
                    // numeric string
                    if (/^\d+$/.test(s)) {
                        const n = Number(s);
                        return n > 1e12 ? n : (n > 1e9 ? n * 1000 : n);
                    }
                    // Normalize common 'YYYY-MM-DD HH:mm:ss' to ISO
                    if (s.length >= 19 && s[10] === ' ' && s.indexOf('T') === -1) {
                        s = s.slice(0, 10) + 'T' + s.slice(11);
                        // If no timezone info, assume UTC
                        if (!/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
                    }
                    const t = Date.parse(s);
                    return Number.isNaN(t) ? 0 : t;
                }
                try {
                    const t = Date.parse(v);
                    return Number.isNaN(t) ? 0 : t;
                } catch {
                    return 0;
                }
            };

            // Map items to a simple role-specific display_time, then sort newest-first
            const withDisplay = arr.map((it) => {
                const submittedAt = it.submitted_at || it.created_at;
                let display_time = null;
                let display_type = 'submitted';

                if (userRole === 'executive') {
                    display_time = submittedAt || it.last_activity_at || it.updated_at;
                    display_type = 'submitted';
                } else if (userRole === 'accountant') {
                    display_time = (
                        it.accountant_approved_at ||
                        it.accountant_declined_at ||
                        it.accountant_reviewed_at ||
                        it.last_accountant_activity_at ||
                        it.last_activity_at ||
                        it.updated_at ||
                        submittedAt
                    );
                    display_type = 'accountant_review';
                } else if (userRole === 'admin') {
                    display_time = (
                        it.admin_approved_at ||
                        it.admin_declined_at ||
                        it.admin_reviewed_at ||
                        it.last_admin_activity_at ||
                        it.last_activity_at ||
                        it.updated_at ||
                        it.accountant_approved_at ||
                        submittedAt
                    );
                    display_type = 'admin_review';
                }

                return { ...it, display_time, display_type };
            });

            withDisplay.sort((a, b) => {
                const ta = toMillis(a.display_time || a.last_activity_at || a.updated_at || a.submitted_at || a.created_at);
                const tb = toMillis(b.display_time || b.last_activity_at || b.updated_at || b.submitted_at || b.created_at);
                if (tb !== ta) return tb - ta; // newest first
                const ida = Number(a.payment_id || a.id || 0);
                const idb = Number(b.payment_id || b.id || 0);
                return idb - ida; // stable tie-break
            });

            arr = withDisplay;
            setItems(arr);
        } catch (e) {
            console.error('Fetch error:', e);
            // swallow for now; could add toast
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchData(''); }, []);

    // Refetch whenever the tab/screen gains focus
    useFocusEffect(
        React.useCallback(() => {
            fetchData(search.trim(), statusFilter);
        }, [fetchData, search, statusFilter])
    );

    // Live refresh after approve/decline via event bus
    useEffect(() => {
        const off = onPaymentUpdate(() => {
            fetchData(search.trim(), statusFilter);
        });
        return off;
    }, [fetchData, search, statusFilter]);

    // Debounce search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { fetchData(search.trim(), statusFilter); }, 250);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [search, statusFilter, fetchData]);

    const statusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'admin_approved') return tokens.colors.success;
        if (s.includes('declined')) return tokens.colors.danger;
        // submitted or accountant_approved => pending
        return tokens.colors.warning || '#e5c558';
    };

    const openDetail = (it) => {
        router.push({ pathname: '/(others)/PaymentApprovalDetail', params: { payment_id: it.payment_id, read_only: '1' } });
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="View payment details">
            <Card style={[styles.rowCard, { borderLeftColor: statusColor(item.status) }]}>
                <View style={styles.rowTop}>
                    <View style={styles.companyInfo}>
                        {!!item.company_name && (
                            <Text style={styles.companyName} numberOfLines={1}>{item.company_name}</Text>
                        )}
                        <Text style={styles.companyCode}>{item.company_code}</Text>
                        <View style={styles.tagRow}>
                            {!!item.company_area && <Tag text={item.company_area} />}
                            {(() => {
                                const execLabel = item.executive_name || item.executive_username;
                                if (!execLabel) return null;
                                const area = (item.company_area || '').trim().toLowerCase();
                                const execVal = String(execLabel).trim().toLowerCase();
                                if (execVal && execVal !== area) {
                                    return <Tag text={execLabel} icon="person" />;
                                }
                                return null;
                            })()}
                        </View>
                    </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.amount, { color: tokens.colors.accent }]}>
                                {formatCurrency(item.amount_collected)}
                            </Text>
                            <View style={{ marginTop: 6 }}>
                                <StatusBadge status={item.status}>
                                    {prettyStatus(item.status)}
                                </StatusBadge>
                            </View>
                            {!!item.allocation_count && (
                                <Text style={styles.bulkHint}>
                                    {item.allocation_count > 1 ? `${item.allocation_count} bills` : (item.first_bill_number ? `Bill ${item.first_bill_number}` : '1 bill')}
                                </Text>
                            )}
                        </View>
                </View>

                <View style={styles.metaRow}>
                    <View style={styles.metaPair}>
                        <Ionicons name="time-outline" size={14} color={tokens.colors.textSubtle} style={{ marginRight: 6 }} />
                        <Text style={styles.metaText}>{formatDateTime(item.display_time || item.last_activity_at)} • {labelForType(item.display_type || item.last_activity_type)}</Text>
                    </View>
                    {!!item.method && (
                        <View style={styles.metaPair}>
                            <Ionicons name="cash-outline" size={14} color={tokens.colors.textSubtle} style={{ marginRight: 6 }} />
                            <Text style={styles.metaText}>{item.method}</Text>
                        </View>
                    )}
                    {!!item.last_comment && (
                        <View style={[styles.metaPair, { marginTop: 6 }]}>
                            <Ionicons name="chatbubble-ellipses-outline" size={14} color={tokens.colors.textSubtle} style={{ marginRight: 6 }} />
                            <Text style={[styles.metaText, { color: tokens.colors.text }]} numberOfLines={2}>{String(item.last_comment)}</Text>
                        </View>
                    )}
                </View>
                {/* Clickable indicator */}
                <View style={styles.clickHint}>
                    <Ionicons name="chevron-forward" size={18} color={tokens.colors.textSubtle} />
                </View>
            </Card>
        </TouchableOpacity>
    );

    return (
        <Screen title="History" subtitle="Latest payment activity" scroll hideBackButton hideTopBar>
            <Card style={styles.searchCard}>
                <View style={styles.searchRow}>
                    <Ionicons name="search" size={18} color={tokens.colors.textSubtle} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by company, area, or executive"
                        placeholderTextColor={tokens.colors.textFaint}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                    />
                </View>
                <View style={styles.filtersRow}>
                    {['all', 'pending', 'approved', 'declined'].map((k) => (
                        <FilterChip key={k} text={k} active={statusFilter === k} onPress={() => setStatusFilter(k)} />
                    ))}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.countText}>{items.length} result{kPlural(items.length)}</Text>
                </View>
            </Card>
            {loading && items.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 30 }}>
                    <ActivityIndicator color={tokens.colors.accent} />
                </View>
            ) : null}
            {items.map((item, idx) => (
                <View key={String(item.payment_id ?? idx)} style={{}}>
                    {renderItem({ item })}
                </View>
            ))}
            {!loading && items.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 30 }}>
                    <Text style={{ color: tokens.colors.textDim }}>No payment activity found</Text>
                </View>
            ) : null}
        </Screen>
    );
}

function labelForType(t) {
    if (t === 'admin_review') return 'Admin Review';
    if (t === 'accountant_review') return 'Accountant Review';
    return 'Submitted';
}

function prettyStatus(s) {
    const v = (s || '').replaceAll('_', ' ');
    return v.charAt(0).toUpperCase() + v.slice(1);
}

function Meta({ label, value, valueColor }) {
    return (
        <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={[styles.metaValue, valueColor && { color: valueColor }]} numberOfLines={2}>
                {value || '—'}
            </Text>
        </View>
    );
}

function Tag({ text, icon }) {
    return (
        <View style={styles.tag}>
            {icon ? <Ionicons name={(icon + '-outline')} size={12} color={tokens.colors.textSubtle} style={{ marginRight: 4 }} /> : null}
            <Text style={styles.tagText} numberOfLines={1}>{text}</Text>
        </View>
    );
}

function FilterChip({ text, active, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{ucfirst(text)}</Text>
        </TouchableOpacity>
    );
}

function ucfirst(s) { if (!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }
function kPlural(n) { return n === 1 ? '' : 's'; }

const styles = StyleSheet.create({
    searchCard: { marginHorizontal: 6, marginBottom: 10, padding: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.cardAlt, borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border, paddingHorizontal: 10, paddingVertical: 8 },
    searchInput: { flex: 1, color: tokens.colors.text, fontSize: 14 },
    filtersRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 },
    rowCard: {
        marginHorizontal: 6,
        marginBottom: 12,
        padding: 12,
        paddingRight: 28,
        paddingBottom: 24,
        borderLeftWidth: 4
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    companyInfo: {
        flex: 1
    },
    clickHint: { position: 'absolute', right: 10, bottom: 10, opacity: 0.7 },
    companyName: {
        fontSize: 16,
        fontWeight: '800',
        color: tokens.colors.text,
        marginBottom: 2
    },
    companyCode: {
        fontSize: 12,
        fontWeight: '700',
        color: tokens.colors.textSubtle,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2
    },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontSize: 11, fontWeight: '700', color: tokens.colors.textSubtle, letterSpacing: 0.4, textTransform: 'uppercase' },
    amount: {
        fontSize: 16,
        fontWeight: '800'
    },
    bulkHint: { marginTop: 6, fontSize: 11, fontWeight: '700', color: tokens.colors.textSubtle },
    metaRow: { marginTop: 6 },
    metaPair: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    metaText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textSubtle },
    metaItem: {
        flexDirection: 'row',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    metaLabel: {
        width: 94,
        fontSize: 11,
        fontWeight: '700',
        color: tokens.colors.textSubtle,
        letterSpacing: 0.4
    },
    metaValue: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: tokens.colors.text
    },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: tokens.colors.border },
    chipActive: { backgroundColor: 'rgba(159,223,86,0.18)', borderColor: tokens.colors.accent },
    chipText: { fontSize: 12, fontWeight: '700', color: tokens.colors.textSubtle, textTransform: 'capitalize' },
    chipTextActive: { color: tokens.colors.accent },
    countText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textDim },
});
