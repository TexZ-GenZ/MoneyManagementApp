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

export default function ApprovedPayments() {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const debounceRef = useRef(null);
    const router = useRouter();

    const fetchData = useCallback(async (q) => {
        setLoading(true);
        try {
            const tok = await StorageService.getToken();
            const url = new URL(`${API_BASE_URL}/payments/activity`);
            url.searchParams.set('limit', '200');
            if (q) url.searchParams.set('search', q);
            
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
            
            // Filter only pending/submitted payments (awaiting approval)
            arr = arr.filter((it) => {
                const s = (it.status || '').toLowerCase();
                return s === 'pending' || s === 'submitted' || s === 'accountant_approved';
            });
            
            // Time parser
            const toMillis = (v) => {
                if (v == null) return 0;
                if (typeof v === 'number') {
                    return v > 1e12 ? v : (v > 1e9 ? v * 1000 : v);
                }
                if (typeof v === 'string') {
                    let s = v.trim();
                    if (/^\d+$/.test(s)) {
                        const n = Number(s);
                        return n > 1e12 ? n : (n > 1e9 ? n * 1000 : n);
                    }
                    if (s.length >= 19 && s[10] === ' ' && s.indexOf('T') === -1) {
                        s = s.slice(0, 10) + 'T' + s.slice(11);
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

            // Pending approvals should show when the payment was collected, not
            // whichever review/import timestamp happened most recently.
            const withDisplay = arr.map((it) => {
                const display_time = it.submitted_at || it.created_at || it.last_activity_at || it.updated_at;
                const display_type = 'submitted';
                return { ...it, display_time, display_type };
            });

            // Sort by newest first
            const sorted = withDisplay.sort((a, b) => toMillis(b.display_time) - toMillis(a.display_time));
            setItems(sorted);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData(search.trim());
    }, [fetchData]);

    useFocusEffect(
        useCallback(() => {
            fetchData(search.trim());
        }, [fetchData, search])
    );

    useEffect(() => {
        const unsub = onPaymentUpdate(() => {
            fetchData(search.trim());
        });
        return unsub;
    }, [fetchData, search]);

    const handleSearch = (text) => {
        setSearch(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { fetchData(text.trim()); }, 250);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(search.trim());
    };

    const statusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'accountant_approved') return tokens.colors.warning;
        if (s === 'submitted' || s === 'pending') return tokens.colors.accent;
        if (s.includes('declined')) return tokens.colors.danger;
        if (s === 'admin_approved') return tokens.colors.success;
        return tokens.colors.accent;
    };

    const prettyStatus = (s) => {
        const lower = (s || '').toLowerCase();
        if (lower === 'accountant_approved') return 'Ready for Approval';
        if (lower === 'submitted' || lower === 'pending') return 'Pending';
        if (lower === 'admin_approved') return 'Approved';
        if (lower === 'declined_by_admin') return 'Declined';
        if (lower === 'declined_by_accountant') return 'Acc Declined';
        return s || '—';
    };

    const openDetail = (it) => {
        router.push({ pathname: '/(others)/PaymentApprovalDetail', params: { payment_id: it.payment_id } });
    };

    const Tag = ({ text, icon }) => (
        <View style={styles.tag}>
            {icon && <Ionicons name={icon} size={10} color={tokens.colors.accent} style={{ marginRight: 4 }} />}
            <Text style={styles.tagText} numberOfLines={1}>{text}</Text>
        </View>
    );

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
                            {(Number(item.amount_collected) === 0) ? 'Change in promise date' : formatCurrency(item.amount_collected)}
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
                        <Text style={styles.metaText}>{formatDateTime(item.display_time || item.last_activity_at)} • Collected</Text>
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
            </Card>
        </TouchableOpacity>
    );

    return (
        <Screen title="Pending Approvals" subtitle="Payments awaiting your approval" scroll={false} backButton>
            <Card style={styles.searchCard}>
                <View style={styles.searchRow}>
                    <Ionicons name="search" size={18} color={tokens.colors.textDim} style={{ marginRight: 10 }} />
                    <TextInput
                        placeholder="Search by company or executive..."
                        placeholderTextColor={tokens.colors.textDim}
                        value={search}
                        onChangeText={handleSearch}
                        style={styles.searchInput}
                    />
                </View>
            </Card>

            {loading && !refreshing ? (
                <View style={styles.loading}><ActivityIndicator color={tokens.colors.accent} size="large" /></View>
            ) : items.length === 0 ? (
                <Card style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={48} color={tokens.colors.textDim} />
                    <Text style={styles.emptyText}>No pending approvals</Text>
                </Card>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(it, idx) => `${it.payment_id || idx}`}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    searchCard: { marginBottom: 16, padding: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, fontSize: 15, color: tokens.colors.text, paddingVertical: 8 },
    loading: { paddingTop: 40, alignItems: 'center' },
    emptyCard: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 15, color: tokens.colors.textDim, marginTop: 12 },
    rowCard: { marginBottom: 12, padding: 16, borderLeftWidth: 4 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    companyInfo: { flex: 1, marginRight: 12 },
    companyName: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginBottom: 4 },
    companyCode: { fontSize: 13, fontWeight: '600', color: tokens.colors.textSubtle, letterSpacing: 0.4 },
    tagRow: { flexDirection: 'row', marginTop: 6, gap: 6, flexWrap: 'wrap' },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.cardAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontSize: 10, fontWeight: '600', color: tokens.colors.accent, letterSpacing: 0.3 },
    amount: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    bulkHint: { fontSize: 11, color: tokens.colors.textDim, marginTop: 4 },
    metaRow: { borderTopWidth: 1, borderColor: tokens.colors.border, paddingTop: 10 },
    metaPair: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    metaText: { fontSize: 12, color: tokens.colors.textDim, flex: 1 },
});
