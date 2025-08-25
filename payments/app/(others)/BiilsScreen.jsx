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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [sortFilter, setSortFilter] = useState('oldest');
    const [statusFilter, setStatusFilter] = useState('pending');
    const router = useRouter();

    const statusOptions = [
        { label: 'All', value: 'all' },
        { label: 'Pending', value: 'pending' },
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

    const fetchBills = async () => {
        setLoading(true); setRefreshing(false);
        try {
            const statusParam = statusFilter === 'all' ? '' : `status=${statusFilter}&`;
            const url = `${API_BASE_URL}/companies/${code}/bills?${statusParam}sort=${sortFilter}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP error');
            const data = await response.json();
            setBills(data.items || []);
        } catch (e) {
            console.error(e); Alert.alert('Error', 'Failed to fetch bills.');
        } finally { setLoading(false); setRefreshing(false); }
    };

    const onRefresh = useCallback(() => { setRefreshing(true); fetchBills(); }, [sortFilter, statusFilter]);

    const normalize = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const visibleBills = useMemo(() => {
        const q = normalize(searchCode.trim());
        if (!q) return bills;
        return bills.filter(b => normalize(b?.bill_number).includes(q));
    }, [bills, searchCode]);

    const renderBillItem = ({ item }) => {
        let overdue = false;
        const effectiveDue = item?.promise_date ? new Date(item.promise_date) : (item?.due_date ? new Date(item.due_date) : null);
        if (effectiveDue) {
            try {
                const today = new Date();
                effectiveDue.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                if (effectiveDue < today) overdue = true;
            } catch (_) { }
        }
        const label = item?.promise_date ? 'Promise' : 'Due';
        return (
            <TouchableOpacity style={styles.billTouchable} activeOpacity={0.7} onPress={() => router.push({ pathname: './PaymentDetail', params: { name, code, amount, outbal, bill_number: item.bill_number, bill_date: item.bill_date, promise_date: item.promise_date || item.due_date, status: item.status, amount_paid: item.amount_paid, bill_amount: item.amount, bill_id: item.id } })}>
                <Card style={styles.billCard}>
                    <View style={styles.billRowTop}>
                        <Text style={styles.billNumber}>{item.bill_number}</Text>
                        <StatusBadge status={item.status} />
                    </View>
                    <View style={styles.billMetaRow}>
                        <Text style={styles.billMeta}>Bill: {formatDate(item.bill_date)}</Text>
                        <Text style={[styles.billMeta, overdue && styles.billMetaOverdue]}>{label}: {formatDate(item.promise_date || item.due_date)}</Text>
                    </View>
                    <View style={styles.billAmounts}>
                        <Text style={styles.amountMain}>{formatCurrency(item.amount)}</Text>
                        <Text style={styles.amountPaidLabel}>Paid <Text style={styles.amountPaid}>{formatCurrency(item.amount_paid)}</Text></Text>
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

    const renderHeader = () => (
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
            <View style={styles.listHeaderRow}><Text style={styles.sectionTitle}>Bills</Text><Text style={styles.count}>{visibleBills.length}</Text></View>
            {loading && (
                <View style={{ marginTop: 10 }}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            )}
        </View>
    );

    return (
        <Screen title={name} subtitle={`Code ${code}`}>
            <FlatList
                data={loading ? [] : visibleBills}
                keyExtractor={item => (item?.id ? item.id.toString() : item.bill_number)}
                renderItem={renderBillItem}
                ListHeaderComponent={renderHeader}
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
    searchInput: { flex: 1, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: tokens.colors.text },
    clearBtn: { marginLeft: 8, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    clearBtnText: { color: tokens.colors.text, fontWeight: '600', fontSize: 12 },
    filtersCard: { marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12 },
    filterChipsWrapper: {},
    chipsRow: { paddingRight: 4, alignItems: 'center' },
    chip: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
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
    billMetaOverdue: { color: tokens.colors.danger, fontWeight: '600' },
    billAmounts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    amountMain: { fontSize: 16, fontWeight: '700', color: tokens.colors.accent },
    amountPaidLabel: { fontSize: 12, color: tokens.colors.textDim },
    amountPaid: { color: tokens.colors.success, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    empty: { textAlign: 'center', color: tokens.colors.textDim, fontSize: 14 },
    retryButton: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    retryText: { color: '#000', fontSize: 14, fontWeight: '600' },
});