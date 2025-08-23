import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StorageService } from '../../src/services/storageService';
import { useAppSelector } from '../../src/store/hooks';
import { useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import StatusBadge from '../../src/ui/components/StatusBadge';
import { tokens } from '../../src/ui/tokens';
import { formatCurrency, formatDateTime, formatDate } from '../../src/ui/format';
import { SkeletonCard } from '../../src/ui/components/SkeletonBlock';

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI;

export default function PaymentDetails() {
    // Params (may be partial / stale, we'll refetch authoritative data)
    const { name, code, amount, outbal, bill_number, bill_id, bill_date, due_date, status, amount_paid } = useLocalSearchParams();
    const [paymentHistory, setPaymentHistory] = useState([]); // raw items from API
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all'); // all | submitted | accountant_approved | admin_approved | declined
    const [sortOrder, setSortOrder] = useState('recent'); // recent | oldest | amount_desc
    const [bill, setBill] = useState(null); // BillOut
    const [company, setCompany] = useState(null); // CompanyBase
    const router = useRouter();
    const userRole = useAppSelector(s => s.auth.user?.role || '');

    useEffect(() => { fetchAll(); }, [bill_id]);

    const fetchAll = async () => {
        await Promise.all([fetchBill(), fetchCompany(), fetchPaymentHistory()]);
    };

    const authHeaders = async () => {
        const tok = await StorageService.getToken();
        return { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok.access_token}` } : {}) };
    };

    const fetchBill = async () => {
        if (!bill_id) return;
        try {
            const h = await authHeaders();
            const r = await fetch(`${API_BASE_URL}/bills/${bill_id}`, { headers: h });
            if (r.ok) { const data = await r.json(); setBill(data); }
        } catch (e) { console.warn('bill fetch failed', e); }
    };

    const fetchCompany = async () => {
        if (!code) return;
        try {
            const h = await authHeaders();
            const r = await fetch(`${API_BASE_URL}/companies/${code}`, { headers: h });
            if (r.ok) { const data = await r.json(); setCompany(data); }
        } catch (e) { console.warn('company fetch failed', e); }
    };


    const fetchPaymentHistory = async () => {
        if (!bill_id) { Alert.alert('Error', 'Bill ID is required.'); setLoading(false); return; }
        try {
            setLoading(true);
            const tok = await StorageService.getToken();
            const r = await fetch(`${API_BASE_URL}/bills/${bill_id}/payments`, { method: 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok.access_token}` } : {}) } });
            if (!r.ok) { if (r.status === 401) { Alert.alert('Error', 'Unauthorized.'); return; } throw new Error('HTTP'); }
            const data = await r.json();
        const payments = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
        setPaymentHistory(payments);
        } catch (e) { console.error(e); Alert.alert('Error', 'Failed to fetch payments.'); }
        finally { setLoading(false); setRefreshing(false); }
    };
    const onRefresh = () => { setRefreshing(true); fetchAll(); };

    const toggleExpand = (idx) => setExpandedIdx(expandedIdx === idx ? null : idx);

    // Derived + filtering/sorting
    const filteredPayments = useMemo(() => {
        let list = [...paymentHistory];
        if (statusFilter !== 'all') {
            list = list.filter(p => (p.payment_status || '').toLowerCase() === statusFilter.toLowerCase());
        }
        list.sort((a, b) => {
            if (sortOrder === 'amount_desc') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
            if (sortOrder === 'oldest') return new Date(a.collected_at) - new Date(b.collected_at);
            return new Date(b.collected_at) - new Date(a.collected_at);
        });
        return list;
    }, [paymentHistory, statusFilter, sortOrder]);

    // Use authoritative bill fields when available
    const billAmountNum = useMemo(() => bill ? parseFloat(bill.amount) : (parseFloat(amount) || 0), [bill, amount]);
    const billPaidNum = useMemo(() => bill ? parseFloat(bill.amount_paid) : (parseFloat(amount_paid) || 0), [bill, amount_paid]);
    const outstandingNum = useMemo(() => billAmountNum - billPaidNum, [billAmountNum, billPaidNum]);
    const totalPaid = billPaidNum; // align with backend's amount_paid, not filtered payments sum

    const statusChips = [
        { label: 'All', value: 'all' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Acc Appr', value: 'accountant_approved' },
        { label: 'Admin Appr', value: 'admin_approved' },
        { label: 'Declined', value: 'declined_by_admin' },
    ];
    const sortChips = [
        { label: 'Recent', value: 'recent' },
        { label: 'Oldest', value: 'oldest' },
        { label: 'Amount', value: 'amount_desc' },
    ];

    const Chip = ({ active, label, onPress }) => (
        <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.75}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    // removed previous totalPaid calc (now derived with filteredPayments)

    const renderPaymentItem = ({ item, index }) => {
        return (
            <Card style={styles.paymentCard}>
                <View style={styles.cardTopRow}>
                    <Text style={styles.amountMain}>{formatCurrency(item.amount)}</Text>
                    <StatusBadge status={item.payment_status} />
                </View>
                <View style={styles.metaRow}>
                    <Meta label="Collected" value={formatDateTime(item.collected_at)} />
                    <Meta label="Method" value={item.method || '—'} />
                    <Meta label="Verified" value={item.exec_location_verified ? 'Yes' : 'No'} />
                </View>
                <TouchableOpacity style={styles.commentsToggle} onPress={() => toggleExpand(index)} activeOpacity={0.7}>
                    <Text style={styles.commentsToggleText}>Details</Text>
                    <Text style={styles.dropdownIcon}>{expandedIdx === index ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expandedIdx === index && (
                    <View style={styles.commentsBox}>
                        <Comment label="Accountant Comment" value={item.accountant_comment} />
                        <Comment label="Admin Comment" value={item.admin_comment} />
                    </View>
                )}
            </Card>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyWrap}><Text style={styles.emptyText}>No payments found.</Text><TouchableOpacity style={styles.retryBtn} onPress={fetchPaymentHistory}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>
    );

    return (
        <Screen title={company?.name || name || code} subtitle={`Bill ${bill?.bill_number || bill_number}`}>            
            {/* Totals Card (ONLY Outstanding + Paid) */}
            <Card style={styles.totalsCard}>
                <View style={styles.totalsRow}>                    
                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Outstanding</Text>
                        <Text style={[styles.totalValue, { color: tokens.colors.danger }]}>{formatCurrency(outstandingNum)}</Text>
                    </View>
                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Paid</Text>
                        <Text style={[styles.totalValue, { color: tokens.colors.success }]}>{formatCurrency(totalPaid)}</Text>
                    </View>
                </View>
            </Card>

            {/* Bill Details */}
            <Card style={styles.infoCard}>
                <View style={styles.billHeadlineRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.billHeadline}>{bill?.bill_number || bill_number}</Text>
                        <Text style={styles.billDates}>{formatDate(bill?.bill_date || bill_date)}  •  Due {formatDate(bill?.due_date || due_date)}</Text>
                    </View>
                    <StatusBadge status={(bill?.status || status || 'pending')} />
                </View>
                <InfoRow label="Bill Amount" value={formatCurrency(billAmountNum)} accent />
                <InfoRow label="Status" value={(bill?.status || status)} />
                <InfoRow label="Paid" value={formatCurrency(totalPaid)} />
                <InfoRow label="Outstanding" value={formatCurrency(outstandingNum)} danger />
                <InfoRow label="Bill Date" value={bill?.bill_date ? formatDate(bill.bill_date) : (bill_date ? formatDate(bill_date) : '—')} />
                <InfoRow label="Due Date" value={bill?.due_date ? formatDate(bill.due_date) : (due_date ? formatDate(due_date) : '—')} />
                <View style={styles.divider} />
                <InfoRow label="Company Code" value={company?.code || code} />
                <InfoRow label="Company Name" value={company?.name || name} />
                <InfoRow label="Executive" value={company?.area || '—'} />
            </Card>
            <Card style={styles.filtersCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                    {statusChips.map(c => <Chip key={c.value} label={c.label} active={statusFilter === c.value} onPress={() => setStatusFilter(c.value)} />)}
                    <View style={styles.filtersDivider} />
                    {sortChips.map(c => <Chip key={c.value} label={c.label} active={sortOrder === c.value} onPress={() => setSortOrder(c.value)} />)}
                </ScrollView>
            </Card>
            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Payment History</Text>
                <Text style={styles.count}>{filteredPayments.length}</Text>
            </View>
            {loading ? (
                <View><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filteredPayments}
                    keyExtractor={(item, idx) => item.id ? item.id.toString() : idx.toString()}
                    renderItem={renderPaymentItem}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
            {userRole === 'executive' && (
                <TouchableOpacity style={styles.fab} onPress={() => router.push({ pathname: './PaymentScreen', params: { company_code: code, bill_id, bill_number, bill_amount: amount } })}>
                    <Text style={styles.fabText}>Add Payment</Text>
                </TouchableOpacity>
            )}
        </Screen>
    );
}

function Row({ label, value, valueColor }) { return (<View style={styles.rowLine}><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, valueColor && { color: valueColor }]}>{value}</Text></View>); }
function Meta({ label, value }) { return (<View style={styles.metaItem}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue} numberOfLines={1}>{value}</Text></View>); }
function Comment({ label, value, valueColor }) { return (<View style={styles.commentRow}><Text style={styles.commentLabel}>{label}</Text><Text style={[styles.commentValue, valueColor && { color: valueColor }]}>{value || 'No comment'}</Text></View>); }
function InfoRow({ label, value, accent, danger }) { return (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, accent && { color: tokens.colors.accent }, danger && { color: tokens.colors.danger }]}>{value}</Text>
    </View>
); }

const styles = StyleSheet.create({
    totalsCard: { marginBottom: 14, padding: 16 },
    infoCard: { marginBottom: 16, padding: 16 },
    billHeadlineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    billHeadline: { color: tokens.colors.text, fontSize: 18, fontWeight: '700' },
    billDates: { color: tokens.colors.textDim, fontSize: 11, marginTop: 4 },
    rowLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    rowLabel: { color: tokens.colors.textDim, fontSize: 12 },
    rowValue: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: tokens.colors.text, fontSize: 15, fontWeight: '700' },
    count: { color: tokens.colors.textDim, marginLeft: 8, fontSize: 12 },
    paymentCard: { marginBottom: 14, padding: 14 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    amountMain: { fontSize: 16, fontWeight: '700', color: tokens.colors.accent, flex: 1 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
    metaItem: { width: '33%', marginBottom: 10 },
    metaLabel: { fontSize: 10, color: tokens.colors.textDim, marginBottom: 2 },
    metaValue: { fontSize: 11, color: tokens.colors.text, fontWeight: '600' },
    commentsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tokens.colors.cardAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4, borderWidth: 1, borderColor: tokens.colors.border },
    commentsToggleText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
    dropdownIcon: { color: tokens.colors.textDim, fontSize: 10, fontWeight: '700' },
    commentsBox: { paddingHorizontal: 12, paddingBottom: 10, marginTop: 6 },
    commentRow: { marginBottom: 10 },
    commentLabel: { color: tokens.colors.textDim, fontSize: 11, fontWeight: '700', marginBottom: 2 },
    commentValue: { color: tokens.colors.text, fontSize: 12, lineHeight: 16 },
    emptyWrap: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: tokens.colors.textDim, fontSize: 15, marginBottom: 14 },
    retryBtn: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    retryText: { color: '#000', fontWeight: '600', fontSize: 14 },
    fab: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: tokens.colors.accent, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    fabText: { color: '#000', fontWeight: '700', fontSize: 15 },
    // removed progress bar (simplified per request)
    chip: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
    chipText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: '#000' },
    filtersCard: { marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12 },
    filtersRow: { alignItems: 'center', paddingRight: 6 },
    filtersDivider: { width: 1, height: 20, backgroundColor: tokens.colors.divider, marginHorizontal: 4 },
    totalsRow: { flexDirection: 'row' },
    totalBox: { flex: 1, paddingRight: 12 },
    totalLabel: { color: tokens.colors.textDim, fontSize: 12, marginBottom: 4, fontWeight: '600' },
    totalValue: { color: tokens.colors.text, fontSize: 20, fontWeight: '700' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    infoLabel: { color: tokens.colors.textDim, fontSize: 12 },
    infoValue: { color: tokens.colors.text, fontSize: 13, fontWeight: '600', marginLeft: 12 },
    divider: { height: 1, backgroundColor: tokens.colors.divider, marginVertical: 10 },
});