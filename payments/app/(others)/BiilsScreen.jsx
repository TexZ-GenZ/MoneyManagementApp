import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
// Picker removed; chip filters used
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import StatusBadge from '../../src/ui/components/StatusBadge';
import { formatCurrency, formatDate } from '../../src/ui/format';
import { SkeletonCard } from '../../src/ui/components/SkeletonBlock';

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI; // unified base

export default function CompanyBillsList() {
    const { name, code, amount, outbal } = useLocalSearchParams();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // pagination removed
    const [sortFilter, setSortFilter] = useState('oldest');
    const [statusFilter, setStatusFilter] = useState('pending');
    // chip filter state (showFilters removed)
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
    const router = useRouter();
    // pagination constants removed

    useEffect(() => { fetchBills(); }, [sortFilter, statusFilter]);

    const fetchBills = async () => {
        setLoading(true); setRefreshing(false);
        try {
            const statusParam = statusFilter === 'all' ? '' : `status=${statusFilter}&`;
            const url = `${API_BASE_URL}/companies/${code}/bills?${statusParam}sort=${sortFilter}`;
            const response = await fetch(url); if (!response.ok) throw new Error('HTTP error');
            const data = await response.json();
            setBills(data.items || []);
        } catch (e) { console.error(e); Alert.alert('Error', 'Failed to fetch bills.'); }
        finally { setLoading(false); setRefreshing(false); }
    };
    const onRefresh = useCallback(() => { setRefreshing(true); fetchBills(); }, [sortFilter, statusFilter]);

    // old accordion filter removed

    const renderBillItem = ({ item }) => {
        // Determine overdue: due_date exists and is strictly before today (local) and not fully paid (optional)
        let overdue = false;
        if (item?.due_date) {
            try {
                const due = new Date(item.due_date);
                const today = new Date();
                // Normalize to date-only comparison
                due.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                if (due < today) overdue = true;
            } catch (_) { /* ignore parse issues */ }
        }
        return (
            <TouchableOpacity style={styles.billTouchable} activeOpacity={0.7} onPress={() => router.push({ pathname: './PaymentDetail', params: { name, code, amount, outbal, bill_number: item.bill_number, bill_date: item.bill_date, promise_date: item.due_date, status: item.status, amount_paid: item.amount_paid, bill_amount: item.amount, bill_id: item.id } })}>
                <Card style={styles.billCard}>
                    <View style={styles.billRowTop}>
                        <Text style={styles.billNumber}>{item.bill_number}</Text>
                        <StatusBadge status={item.status} />
                    </View>
                    <View style={styles.billMetaRow}>
                        <Text style={styles.billMeta}>Bill: {formatDate(item.bill_date)}</Text>
                        <Text style={[styles.billMeta, overdue && styles.billMetaOverdue]}>Promise: {formatDate(item.due_date)}</Text>
                    </View>
                    <View style={styles.billAmounts}>
                        <Text style={styles.amountMain}>{formatCurrency(item.amount)}</Text>
                        <Text style={styles.amountPaidLabel}>Paid <Text style={styles.amountPaid}>{formatCurrency(item.amount_paid)}</Text></Text>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };
    // footer removed (no pagination)
    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No bills found for the selected filters.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchBills}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
    );
    const renderHeader = () => (
        <View>
            <Card style={styles.companyCard}>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Outstanding Balance</Text>
                        <Text style={styles.statValueDanger}>{formatCurrency(outbal)}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Amount</Text>
                        <Text style={styles.statValueAccent}>{formatCurrency(amount)}</Text>
                    </View>
                </View>
            </Card>
            <Card style={styles.filtersCard}>
                {renderFilters()}
            </Card>
            <View style={styles.listHeaderRow}><Text style={styles.sectionTitle}>Bills</Text><Text style={styles.count}>{bills.length}</Text></View>

            {loading && (
                <View style={{ marginTop: 10 }}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            )}
        </View>
    );

    return (
        <Screen title={name} subtitle={`Code ${code}`}>
            <FlatList
                data={loading ? [] : bills}
                keyExtractor={item => (item?.id ? item.id.toString() : item.bill_number)}
                renderItem={renderBillItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={!loading ? renderEmptyComponent : null}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    companyCard: { marginBottom: 16 },
    statsRow: { flexDirection: 'row', gap: 12 },
    statBox: { flex: 1, backgroundColor: tokens.colors.cardAlt, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: tokens.colors.border },
    statLabel: { fontSize: 11, color: tokens.colors.textDim, marginBottom: 6, letterSpacing: 0.3, fontWeight: '600' },
    statValueAccent: { fontSize: 15, fontWeight: '700', color: tokens.colors.accent },
    statValueDanger: { fontSize: 15, fontWeight: '700', color: tokens.colors.danger },
    listHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: tokens.colors.text, fontWeight: '700', fontSize: 16 },
    count: { color: tokens.colors.textDim, marginLeft: 8, fontSize: 13 },
    // old accordion filter styles removed
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
    footerLoader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
    loadingText: { marginLeft: 10, fontSize: 14, color: tokens.colors.textDim },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    empty: { textAlign: 'center', color: tokens.colors.textDim, fontSize: 14, marginBottom: 16 },
    billLabelsRow: { flexDirection: 'row', paddingHorizontal: 2, marginBottom: 8 },
    billLabelCol: { fontSize: 10, color: tokens.colors.textSubtle, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    retryButton: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    retryText: { color: '#000', fontSize: 14, fontWeight: '600' },
    filtersCard: { marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12 },
    filterChipsWrapper: {},
    chipsRow: { paddingRight: 4, alignItems: 'center' },
    chip: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
    chipText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: '#000' },
    dividerVertical: { width: 1, height: 20, backgroundColor: tokens.colors.divider, marginHorizontal: 2 },
});