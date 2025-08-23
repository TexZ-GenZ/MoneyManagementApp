import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import StatusBadge from './StatusBadge';
import { tokens } from '../tokens';
import { formatCurrency, formatDateTime } from '../format';

export default function ApprovalItemCard({ item, execName, onApprove, onReject, actionLoadingId, submitting }) {
    const loadingThis = actionLoadingId === item.id || submitting;
    return (
        <Card style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.company}>{item.company_code}</Text>
                <Text style={styles.amount}>{formatCurrency(item.amount_collected)}</Text>
                <StatusBadge status={item.status} style={{ marginLeft: 8 }} />
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.exec}>{execName}</Text>
                <Text style={styles.method}>{item.method?.charAt(0).toUpperCase() + item.method?.slice(1)}</Text>
            </View>
            <View style={styles.metaGrid}>
                <Meta label="Collected" value={formatDateTime(item.collected_at)} />
                {item.next_promise_date ? <Meta label="Next Promise" value={formatDateTime(item.next_promise_date, true)} /> : null}
                <Meta label="Location" value={item.exec_location_verified ? 'Verified' : 'Unverified'} valueColor={item.exec_location_verified ? tokens.colors.success : tokens.colors.danger} />
            </View>
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
    method: { fontSize: 12, fontWeight: '500', color: tokens.colors.textDim },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    metaItem: { width: '33%', marginTop: 10 },
    metaLabel: { fontSize: 11, color: tokens.colors.textSubtle, marginBottom: 2 },
    metaValue: { fontSize: 12, fontWeight: '600', color: tokens.colors.text },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
    actionBtn: { width: 46, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    approveBtn: { backgroundColor: tokens.colors.success },
    rejectBtn: { backgroundColor: tokens.colors.danger },
    disabled: { opacity: 0.5 },
});
