import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './Card';
import StatusBadge from './StatusBadge';
import { tokens } from '../tokens';
import { formatCurrency, formatDateTime } from '../format';

// Rich info card (company + payment meta). Approval happens in detail screen.
export default function ApprovalItemCard({ item }) {
    const router = useRouter();
    const hasCoords = item.exec_lat && item.exec_lng;
    const navigateDetail = () => router.push({ pathname: '../(others)/PaymentApprovalDetail', params: { payment_id: item.id } });
    return (
        <Card style={styles.card}>
            <TouchableOpacity activeOpacity={0.8} onPress={navigateDetail}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={styles.companyName} numberOfLines={1}>{item.company_name || '—'}</Text>
                        <View style={styles.subRow}>
                            <Text style={styles.companyCode}>{item.company_code}</Text>
                            {item.company_area ? <Text style={styles.areaBadge} numberOfLines={1}>{item.company_area}</Text> : null}
                        </View>
                    </View>
                    <View style={styles.topRight}>
                        <Text style={styles.amount}>
                            {(Number(item.amount_collected) === 0 && item.next_promise_date) ? 'Change in promise date' : formatCurrency(item.amount_collected)}
                        </Text>
                        <StatusBadge status={item.status} style={{ marginTop: 6 }} />
                    </View>
                </View>
                <View style={styles.metaList}>
                    <Meta label="Collected" value={formatDateTime(item.collected_at)} />
                    {item.next_promise_date ? <Meta label="Next Promise" value={formatDateTime(item.next_promise_date, true)} /> : null}
                    <Meta label="Method" value={item.method?.charAt(0).toUpperCase() + item.method?.slice(1)} />
                    <Meta label="Location" value={hasCoords ? 'Captured' : '—'} valueColor={hasCoords ? tokens.colors.success : tokens.colors.textDim} />
                </View>
                <Text style={styles.expandHint}>Tap to review & approve / decline</Text>
            </TouchableOpacity>
        </Card>
    );
}

function Meta({ label, value, valueColor }) {
    return (
        <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={[styles.metaValue, valueColor && { color: valueColor }]} numberOfLines={2}>{value || '—'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: 16, padding: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    companyName: { fontSize: 16, fontWeight: '700', color: tokens.colors.text },
    subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 10 },
    companyCode: { fontSize: 12, fontWeight: '600', color: tokens.colors.textSubtle, letterSpacing: 0.4 },
    areaBadge: { fontSize: 11, fontWeight: '600', color: tokens.colors.accent, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    topRight: { alignItems: 'flex-end', marginLeft: 10 },
    amount: { fontSize: 16, fontWeight: '700', color: tokens.colors.accent },
    metaList: { marginTop: 4 },
    metaRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    metaLabel: { width: 110, fontSize: 11, fontWeight: '600', color: tokens.colors.textSubtle, letterSpacing: 0.5 },
    metaValue: { flex: 1, fontSize: 12, fontWeight: '600', color: tokens.colors.text },
    expandHint: { marginTop: 10, fontSize: 12, color: tokens.colors.textSubtle, textAlign: 'center' },
});
