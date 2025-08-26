import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import StatusBadge from '../../src/ui/components/StatusBadge';
import { formatCurrency, formatDate } from '../../src/ui/format';
import { SkeletonCard } from '../../src/ui/components/SkeletonBlock';
import { onPaymentUpdate } from '../../src/events/paymentEvents';

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI; // unified base

export default function CompanyBillsList() {
    const { name, code, amount, outbal } = useLocalSearchParams();
    const [bills, setBills] = useState([]);
    const [totalCount, setTotalCount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [sortFilter, setSortFilter] = useState('oldest');
    const [statusFilter, setStatusFilter] = useState('all');
    const router = useRouter();

    const statusOptions = [
        { label: 'All', value: 'all' },
        { label: 'Pending', value: 'pending' },
        { label: 'Overdue', value: 'overdue' },
        { label: 'Paid', value: 'paid' },
    ];
    const sortOptions = [
        { label: 'Oldest', value: 'oldest' },
        { label: 'Recent', value: 'recent' },
        { label: 'Amount', value: 'amount_desc' },
    ];

    const FilterChip = ({ active, label, onPress }) => (
        <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderFilters = () => (
        <View style={styles.filterChipsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {statusOptions.map(o => (
                    <FilterChip key={o.value} label={o.label} active={statusFilter === o.value} onPress={() => setStatusFilter(o.value)} />
                ))}
                <View style={styles.dividerVertical} />
                {sortOptions.map(o => (
                    <FilterChip key={o.value} label={o.label} active={sortFilter === o.value} onPress={() => setSortFilter(o.value)} />
                ))}
            </ScrollView>
        </View>
    );

    useEffect(() => { fetchBills(); }, [sortFilter, statusFilter]);
    useFocusEffect(useCallback(() => { fetchBills(); }, [code, sortFilter, statusFilter]));

    useEffect(() => {
        const off = onPaymentUpdate(() => { fetchBills(); });
        return off;
    }, [code, sortFilter, statusFilter]);

    // Helper: determine if a bill is overdue (pending and effective due <= today at 00:00)
    const isBillOverdue = useCallback((b) => {
        if (!b || b.status !== 'pending') return false;
        const d = b?.promise_date || b?.due_date;
        if (!d) return false;
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const target = new Date(d); target.setHours(0, 0, 0, 0);
            return target.getTime() <= today.getTime();
        } catch { return false; }
    }, []);

    const fetchBills = async () => {
        setLoading(true); setRefreshing(false);
        try {
            // For 'overdue', we fetch pending from API and filter client-side by effective due <= today
            const apiStatus = statusFilter === 'overdue' ? 'pending' : (statusFilter === 'all' ? '' : statusFilter);
            const statusParam = apiStatus ? `status=${apiStatus}&` : '';
            const url = `${API_BASE_URL}/companies/${code}/bills?${statusParam}sort=${sortFilter}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP error');
            const data = await response.json();
            setBills(data.items || []);
            const apiTotal = (
                typeof data.total === 'number' ? data.total :
                typeof data.total_count === 'number' ? data.total_count :
                typeof data.count === 'number' ? data.count :
                typeof data.items_total === 'number' ? data.items_total :
                typeof data.totalItems === 'number' ? data.totalItems :
                typeof data.total_items === 'number' ? data.total_items :
                null
            );
            setTotalCount(apiTotal);
        } catch (e) {
            console.error(e); Alert.alert('Error', 'Failed to fetch bills.'); setTotalCount(null);
        } finally { setLoading(false); setRefreshing(false); }
    };

    const onRefresh = useCallback(() => { setRefreshing(true); fetchBills(); }, [sortFilter, statusFilter]);

    const normalize = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const visibleBills = useMemo(() => {
        const q = normalize(searchCode.trim());
        const base = bills.filter(b => !q || normalize(b?.bill_number).includes(q));
        if (statusFilter === 'overdue') {
            // Only overdue pending bills
            return base.filter(isBillOverdue);
        }
        if (statusFilter === 'pending') {
            // Only pending but NOT overdue
            return base.filter(b => b?.status === 'pending' && !isBillOverdue(b));
        }
        if (statusFilter === 'paid') {
            return base.filter(b => b?.status === 'paid');
        }
        return base;
    }, [bills, searchCode, statusFilter, isBillOverdue]);

    const renderBillItem = ({ item }) => {
        const isOverdue = isBillOverdue(item);
        const label = 'Promise';
        const isPaid = item?.status === 'paid';
        const isPending = item?.status === 'pending' && !isOverdue;
        const amountStyle = [
            styles.amountMain,
            isOverdue ? styles.amountOverdue : (isPending ? styles.amountPending : styles.amountFine),
        ];
        const promiseStyle = [
            styles.billMetaPromise,
            isOverdue ? styles.billMetaOverdue : (isPending ? styles.billMetaPending : null),
        ];
        const displayStatus = isOverdue ? 'overdue' : item.status;
        return (
            <TouchableOpacity style={styles.billTouchable} activeOpacity={0.7} onPress={() => router.push({ pathname: './PaymentDetail', params: { name, code, amount, outbal, bill_number: item.bill_number, bill_date: item.bill_date, promise_date: item.promise_date || item.due_date, status: item.status, amount_paid: item.amount_paid, bill_amount: item.amount, bill_id: item.id } })}>
                <Card style={styles.billCard}>
                    <View style={styles.billRowTop}>
                        <Text style={styles.billNumber}>{item.bill_number}</Text>
                        <StatusBadge status={displayStatus} />
                    </View>
                    <View style={styles.billMetaRow}>
                        <Text style={styles.billMeta}>Bill: {formatDate(item.bill_date)}</Text>
                        <Text style={promiseStyle}>{label}: {formatDate(item.promise_date || item.due_date)}</Text>
                    </View>
                    <View style={styles.amountsRow}>
                        <View style={styles.billAmounts}>
                            <Text style={amountStyle}>{formatCurrency(item.amount)}</Text>
                            <Text style={styles.amountPaidLabel}>Paid <Text style={styles.amountPaid}>{formatCurrency(item.amount_paid)}</Text></Text>
                        </View>
                        <View style={styles.tapHintRow}>
                            <Text style={styles.tapHint}>Tap for details</Text>
                            <Text style={styles.tapHintChevron}>›</Text>
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No bills found for the selected filters.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchBills}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
    );

    // Header moved inline into ListHeaderComponent to avoid remounts and keep TextInput focus stable

    return (
        <Screen title={name} subtitle={`Code ${code}`}>
            <FlatList
                data={loading ? [] : visibleBills}
                keyExtractor={item => (item?.id ? item.id.toString() : item.bill_number)}
                renderItem={renderBillItem}
                ListHeaderComponent={(
                    <View>
                        <Card style={styles.searchCard}>
                            <View style={styles.searchRow}>
                                <TextInput
                                    value={searchCode}
                                    onChangeText={setSearchCode}
                                    placeholder="Search by bill code"
                                    placeholderTextColor={tokens.colors.textDim}
                                    style={styles.searchInput}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    returnKeyType="search"
                                    blurOnSubmit={false}
                                />
                                {searchCode?.length > 0 && (
                                    <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchCode('')} activeOpacity={0.7}>
                                        <Text style={styles.clearBtnText}>Clear</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </Card>
                        <View style={styles.statPillsRow}>
                            <View style={styles.statPill}>
                                <Text style={styles.statPillLabel}>Outstanding</Text>
                                <Text style={[styles.statPillValue, { color: tokens.colors.danger }]}>{formatCurrency(outbal)}</Text>
                            </View>
                            <View style={styles.statPill}>
                                <Text style={styles.statPillLabel}>Total</Text>
                                <Text style={[styles.statPillValue, { color: tokens.colors.accent }]}>{formatCurrency(amount)}</Text>
                            </View>
                        </View>
                        <Card style={styles.filtersCard}>
                            {renderFilters()}
                        </Card>
                        <View style={styles.listHeaderRow}><Text style={styles.sectionTitle}>Bills</Text><Text style={styles.count}>{totalCount ?? visibleBills.length}</Text></View>
                        {loading && (
                            <View style={{ marginTop: 10 }}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
                        )}
                    </View>
                )}
                ListEmptyComponent={!loading ? renderEmptyComponent : null}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    // Compact stat pills
    statPillsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    statPill: { flex: 1, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
    statPillLabel: { fontSize: 10, color: tokens.colors.textDim, fontWeight: '600', marginBottom: 2 },
    statPillValue: { fontSize: 13, fontWeight: '700', color: tokens.colors.text },
    searchCard: { marginBottom: 12, padding: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: tokens.colors.text, fontSize: 16 },
    clearBtn: { marginLeft: 8, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    clearBtnText: { color: tokens.colors.text, fontWeight: '600', fontSize: 12 },
    filtersCard: { marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12 },
    filterChipsWrapper: {},
    chipsRow: { paddingRight: 4, alignItems: 'center' },
    chip: { backgroundColor: tokens.colors.cardAlt, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: tokens.colors.border },
    chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
    chipText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: '#000' },
    dividerVertical: { width: 1, height: 20, backgroundColor: tokens.colors.divider, marginHorizontal: 2 },
    listHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: tokens.colors.text, fontWeight: '700', fontSize: 16 },
    count: { color: tokens.colors.textDim, marginLeft: 8, fontSize: 13 },
    billTouchable: { marginBottom: 14 },
    billCard: { padding: 16 },
    billRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    billNumber: { fontSize: 15, fontWeight: '700', color: tokens.colors.text, flex: 1 },
    billMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    billMeta: { fontSize: 12, color: tokens.colors.textDim },
    billMetaPromise: { fontSize: 13, color: tokens.colors.text, fontWeight: '700' },
    billMetaOverdue: { color: tokens.colors.danger, fontWeight: '700' },
    billMetaPending: { color: (tokens.colors.warning || '#f5b100'), fontWeight: '700' },
    amountsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    billAmounts: { flexDirection: 'column', alignItems: 'flex-start' },
    amountMain: { fontSize: 16, fontWeight: '700', color: tokens.colors.accent },
    amountOverdue: { color: tokens.colors.danger },
    amountPending: { color: (tokens.colors.warning || '#f5b100') },
    amountFine: { color: tokens.colors.text },
    amountPaidLabel: { fontSize: 15, color: tokens.colors.textDim, fontWeight: '700', marginTop: 2 },
    amountPaid: { color: tokens.colors.success, fontWeight: '700', fontSize: 17 },
    tagOverdue: { backgroundColor: tokens.colors.danger, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: '#000' },
    tagOverdueText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    tapHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingLeft: 10 },
    tapHint: { fontSize: 13, color: tokens.colors.textSubtle, fontWeight: '600', letterSpacing: 0.4 },
    tapHintChevron: { fontSize: 16, lineHeight: 16, color: tokens.colors.accent, fontWeight: '700' },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    empty: { textAlign: 'center', color: tokens.colors.textDim, fontSize: 14 },
    retryButton: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    retryText: { color: '#000', fontSize: 14, fontWeight: '600' },
});