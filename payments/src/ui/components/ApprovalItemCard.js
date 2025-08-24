import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import StatusBadge from './StatusBadge';
import { tokens } from '../tokens';
import { formatCurrency, formatDateTime } from '../format';

export default function ApprovalItemCard({ item, onApprove, onReject, actionLoadingId, submitting }) {
    const loadingThis = actionLoadingId === item.id || submitting;
    const router = useRouter();
    const hasCoords = item.exec_lat && item.exec_lng;
    const navigateDetail = () => router.push({ pathname: '../(others)/PaymentApprovalDetail', params: { payment_id: item.id } });
    return (
        <Card style={styles.card}>
            <TouchableOpacity activeOpacity={0.75} onPress={navigateDetail}>
                <View style={styles.headerRow}>
                    <Text style={styles.company}>{item.company_code}</Text>
                    <Text style={styles.amount}>{formatCurrency(item.amount_collected)}</Text>
                    <StatusBadge status={item.status} style={{ marginLeft: 8 }} />
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.exec} numberOfLines={1}>{item.company_name || item.company_code}</Text>
                    <Text style={styles.method} numberOfLines={1}>{item.company_area || '—'}</Text>
                </View>
                <View style={styles.metaGrid}>
                    <Meta label="Collected" value={formatDateTime(item.collected_at)} />
                    {item.next_promise_date ? <Meta label="Next Promise" value={formatDateTime(item.next_promise_date, true)} /> : null}
                    <Meta label="Method" value={item.method?.charAt(0).toUpperCase() + item.method?.slice(1)} />
                    <Meta label="Location" value={hasCoords ? 'Captured' : '—'} valueColor={hasCoords ? tokens.colors.success : tokens.colors.textDim} />
                </View>
                <Text style={styles.expandHint}>Tap for full details</Text>
            </TouchableOpacity>
            <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn, loadingThis && styles.disabled]} onPress={() => onReject(item)} disabled={loadingThis}>
                    <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.approveBtn, loadingThis && styles.disabled]} onPress={() => onApprove(item)} disabled={loadingThis}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </Card>
    );
}

function Meta({ label, value, valueColor, }) {
    return (
        <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={[styles.metaValue, valueColor && { color: valueColor }]} numberOfLines={1}>{value || '—'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: 16, padding: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    company: { fontSize: 15, fontWeight: '700', color: tokens.colors.text, flex: 1 },
    amount: { fontSize: 14, fontWeight: '600', color: tokens.colors.accent },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    exec: { fontSize: 13, fontWeight: '600', color: tokens.colors.textDim },
    method: { fontSize: 12, fontWeight: '700', color: tokens.colors.accent },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    metaItem: { width: '33%', marginTop: 10 },
    metaLabel: { fontSize: 11, color: tokens.colors.textSubtle, marginBottom: 2 },
    metaValue: { fontSize: 12, fontWeight: '600', color: tokens.colors.text },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
    actionBtn: { width: 46, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    approveBtn: { backgroundColor: tokens.colors.success },
    rejectBtn: { backgroundColor: tokens.colors.danger },
    disabled: { opacity: 0.5 },
    mapPill: { backgroundColor: tokens.colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 10 },
    mapPillText: { color: '#000', fontSize: 11, fontWeight: '700' },
    expandHint: { marginTop: 10, fontSize: 10, color: tokens.colors.textSubtle, textAlign: 'center' },
});
