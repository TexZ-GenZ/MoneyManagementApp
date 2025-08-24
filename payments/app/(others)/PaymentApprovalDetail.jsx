import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ActivityIndicator, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { emitPaymentUpdate } from '../../src/events/paymentEvents';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import { useSelector } from 'react-redux';
import { Card } from '../../src/ui/components/Card';
import StatusBadge from '../../src/ui/components/StatusBadge';
import { tokens } from '../../src/ui/tokens';
import { StorageService } from '../../src/services/storageService';
import { formatCurrency, formatDateTime } from '../../src/ui/format';

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI;

export default function PaymentApprovalDetail() {
    const { payment_id } = useLocalSearchParams();
    const [payment, setPayment] = useState(null);
    const [company, setCompany] = useState(null);
    const [executive, setExecutive] = useState(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [declineVisible, setDeclineVisible] = useState(false);
    const [declineComment, setDeclineComment] = useState('');
    const [declining, setDeclining] = useState(false);
    const [approveComment, setApproveComment] = useState('');
    const [showMap, setShowMap] = useState(true);
    const [outerScrollEnabled, setOuterScrollEnabled] = useState(true);
    const router = useRouter();
    const currentUser = useSelector(state => state.auth?.user);

    useEffect(() => { load(); }, [payment_id]);

    const authHeaders = async () => {
        const t = await StorageService.getToken();
        return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t.access_token}` } : {}) };
    };

    const load = async () => {
        if (!payment_id) return; setLoading(true);
        try {
            const h = await authHeaders();
            const pr = await fetch(`${API_BASE_URL}/payments/${payment_id}`, { headers: h });
            if (!pr.ok) throw new Error('Payment fetch failed');
            const pdata = await pr.json();
            setPayment(pdata);
            // company
            if (pdata.company_code) {
                const cr = await fetch(`${API_BASE_URL}/companies/${pdata.company_code}`, { headers: h });
                if (cr.ok) setCompany(await cr.json());
            }
            // executive (user) lookup if endpoint exists
            if (pdata.executive_id) {
                // Attempt /users/{id}
                try { const er = await fetch(`${API_BASE_URL}/users/${pdata.executive_id}`, { headers: h }); if (er.ok) setExecutive(await er.json()); } catch { }
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to load payment details');
        } finally { setLoading(false); }
    };

    const openMap = () => {
        if (!(payment?.exec_lat && payment?.exec_lng)) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${payment.exec_lat},${payment.exec_lng}`;
        Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open maps URL'));
    };

    const handleApprove = async () => {
        if (!payment) return; setApproving(true);
        try {
            const t = await StorageService.getToken();
            const comment = encodeURIComponent((approveComment || '').trim());
            const isAdminStage = payment.status === 'accountant_approved' && currentUser?.role === 'admin';
            const base = isAdminStage ? 'admin' : 'accountant';
            const url = `${API_BASE_URL}/${base}/payments/${payment.id}/approve${comment ? `?comment=${comment}` : ''}`;
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t.access_token}` } : {}) } });
            if (!r.ok) throw new Error('Approve failed');
            const updated = await r.json().catch(() => null);
            // Optimistic local update
            const newStatus = isAdminStage ? 'admin_approved' : 'accountant_approved';
            setPayment(p => p ? { ...p, status: newStatus, [isAdminStage ? 'admin_comment' : 'accountant_comment']: approveComment || p[isAdminStage ? 'admin_comment' : 'accountant_comment'] } : p);
            emitPaymentUpdate({ id: payment.id, status: newStatus });
            // Navigate back to list immediately (no need to stay)
            router.back();
            setApproveComment('');
        } catch (e) {
            Alert.alert('Error', 'Failed to approve payment');
        } finally { setApproving(false); }
    };

    const handleDecline = () => { setDeclineVisible(true); setDeclineComment(''); };

    const submitDecline = async () => {
        if (!payment) return; setDeclining(true);
        try {
            const t = await StorageService.getToken();
            const comment = encodeURIComponent((declineComment || '').trim());
            const isAdminStage = payment.status === 'accountant_approved' && currentUser?.role === 'admin';
            const base = isAdminStage ? 'admin' : 'accountant';
            const r = await fetch(`${API_BASE_URL}/${base}/payments/${payment.id}/decline?comment=${comment}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t.access_token}` } : {}) } });
            if (!r.ok) throw new Error('Decline failed');
            await r.json().catch(() => null);
            const newStatus = isAdminStage ? 'declined_by_admin' : 'declined_by_accountant';
            setPayment(p => p ? { ...p, status: newStatus, [isAdminStage ? 'admin_comment' : 'accountant_comment']: declineComment || p[isAdminStage ? 'admin_comment' : 'accountant_comment'] } : p);
            emitPaymentUpdate({ id: payment.id, status: newStatus });
            setDeclineVisible(false);
            // Return to list
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to decline payment');
        } finally { setDeclining(false); }
    };

    return (
        <Screen title={payment ? payment.company_code : 'Payment'} subtitle={payment ? `ID ${payment.id}` : ''}>
            {loading ? <ActivityIndicator color={tokens.colors.accent} style={{ marginTop: 40 }} /> : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} scrollEnabled={outerScrollEnabled}>
                    <Card style={styles.card}>
                        <View style={styles.topRow}>
                            <Text style={styles.amount}>{formatCurrency(payment.amount_collected)}</Text>
                            <StatusBadge status={payment.status} />
                        </View>
                        <Info label="Collected At" value={formatDateTime(payment.collected_at)} />
                        <Info label="Method" value={payment.method} />
                        {payment.next_promise_date && <Info label="Next Promise" value={payment.next_promise_date} />}
                        <Info label="Executive ID" value={String(payment.executive_id)} />
                        {executive?.username && <Info label="Executive User" value={executive.username} />}
                        {company?.name && <Info label="Company" value={company.name} />}
                        {company?.area && <Info label="Executive Area" value={company.area} />}
                        {payment.exec_lat && payment.exec_lng && (
                            <View style={{ marginTop: 16 }}>
                                <View style={styles.locationHeaderRow}>
                                    <Text style={styles.sectionTitle}>Location</Text>
                                    <TouchableOpacity onPress={() => setShowMap(s => !s)}>
                                        <Text style={styles.toggleLink}>{showMap ? 'Hide' : 'Show'}</Text>
                                    </TouchableOpacity>
                                </View>
                                {showMap && (
                                    <View
                                        style={styles.mapEmbedWrapper}
                                        onTouchStart={() => setOuterScrollEnabled(false)}
                                        onTouchEnd={() => setOuterScrollEnabled(true)}
                                        onTouchCancel={() => setOuterScrollEnabled(true)}
                                    >
                                        <WebView
                                            style={styles.mapWebView}
                                            originWhitelist={["*"]}
                                            scrollEnabled={false}
                                            source={{
                                                uri: (() => {
                                                    const lat = payment.exec_lat;
                                                    const lng = payment.exec_lng;
                                                    const zoom = 17; // desired zoom
                                                    const d = 0.0008; // tight bbox for zoomed-in view
                                                    const bbox = `${(lng - d).toFixed(6)},${(lat - d).toFixed(6)},${(lng + d).toFixed(6)},${(lat + d).toFixed(6)}`;
                                                    // OSM embed honors #map=ZOOM/LAT/LON fragment for initial zoom; commas should remain unencoded
                                                    return `https://www.openstreetmap.org/export/embed.html?layer=mapnik&bbox=${bbox}&marker=${lat},${lng}#map=${zoom}/${lat}/${lng}`;
                                                })()
                                            }}
                                        />
                                        <TouchableOpacity style={styles.inlineMapOpen} onPress={openMap}>
                                            <Text style={styles.inlineMapOpenText}>Open in Maps</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </Card>
                    <Card style={[styles.card, styles.actionsCard]}>
                        <Text style={styles.sectionTitle}>{(payment.status === 'accountant_approved' && currentUser?.role === 'admin') ? 'Admin Action' : 'Accountant Action'}</Text>
                        <TextInput
                            style={styles.approveInput}
                            placeholder={(payment.status === 'accountant_approved' && currentUser?.role === 'admin') ? 'Add admin approval comment (optional)' : 'Add accountant approval comment (optional)'}
                            placeholderTextColor={tokens.colors.textSubtle}
                            value={approveComment}
                            onChangeText={setApproveComment}
                            editable={!approving && !declining}
                        />
                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn, (approving || declining) && styles.disabledBtn]}
                                onPress={handleApprove}
                                disabled={approving || declining}
                            >
                                {approving ? <ActivityIndicator color="#000" /> : <Text style={styles.actionText}>Approve</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.declineBtn, (approving || declining) && styles.disabledBtn]}
                                onPress={handleDecline}
                                disabled={approving || declining}
                            >
                                <Text style={styles.actionText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.actionHint}>
                            {(payment.status === 'accountant_approved' && currentUser?.role === 'admin')
                                ? 'Admin approves or declines payments already reviewed by accountant.'
                                : 'Accountant initial review stage.'}
                        </Text>
                    </Card>
                    <Card style={styles.card}>
                        <View style={styles.allocHeaderRow}>
                            <Text style={[styles.sectionTitle, { flex: 1 }]}>Allocations</Text>
                            {payment.allocations?.length ? <Text style={styles.allocTotal}>Total {formatCurrency(payment.allocations.reduce((s, a) => s + Number(a.amount_allocated || 0), 0))}</Text> : null}
                        </View>
                        {payment.allocations?.length ? (
                            <View style={styles.allocTable}>
                                <View style={styles.allocHead}><Text style={[styles.allocHeadText, { flex: 1 }]}>Bill #</Text><Text style={styles.allocHeadText}>Amount</Text></View>
                                {payment.allocations.map(a => (
                                    <View key={a.bill_id} style={styles.allocRow}>
                                        <Text style={[styles.allocBill, { flex: 1 }]} numberOfLines={1}>{a.bill_number}</Text>
                                        <Text style={styles.allocAmt}>{formatCurrency(a.amount_allocated)}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : <Text style={styles.dim}>No allocations</Text>}
                    </Card>
                    <Card style={styles.card}>
                        <Text style={styles.sectionTitle}>Review Trail</Text>
                        <Info label="Accountant Comment" value={payment.accountant_comment || '—'} />
                        <Info label="Admin Comment" value={payment.admin_comment || '—'} />
                    </Card>
                    <Modal visible={declineVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalBox}>
                                <Text style={styles.modalTitle}>Decline Payment</Text>
                                <Text style={styles.modalSub}>{payment?.company_code} • {formatCurrency(payment?.amount_collected || 0)}</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Add a comment (optional)"
                                    placeholderTextColor={tokens.colors.textSubtle}
                                    value={declineComment}
                                    onChangeText={setDeclineComment}
                                    multiline
                                    editable={!declining}
                                />
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity style={[styles.modalBtn, styles.modalDeclineBtn, declining && styles.disabledBtn]} onPress={submitDecline} disabled={declining}>
                                        {declining ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Submit Decline</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => !declining && setDeclineVisible(false)} disabled={declining}>
                                        <Text style={styles.modalBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity style={styles.closeIcon} onPress={() => !declining && setDeclineVisible(false)} disabled={declining}>
                                    <Ionicons name="close-circle" size={30} color={tokens.colors.danger} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </ScrollView>
            )}
        </Screen>
    );
}

function Info({ label, value }) {
    return (
        <View style={styles.infoRow}> <Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{String(value)}</Text></View>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: 16, padding: 16 },
    topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    amount: { flex: 1, fontSize: 22, fontWeight: '700', color: tokens.colors.accent },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    infoLabel: { fontSize: 12, color: tokens.colors.textDim },
    infoValue: { fontSize: 13, fontWeight: '600', color: tokens.colors.text, marginLeft: 12 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: tokens.colors.text, marginBottom: 10 },
    allocRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    allocBill: { fontSize: 12, color: tokens.colors.text },
    allocAmt: { fontSize: 12, fontWeight: '600', color: tokens.colors.text },
    allocHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    allocTotal: { fontSize: 12, fontWeight: '600', color: tokens.colors.textDim },
    allocTable: { marginTop: -4 },
    allocHead: { flexDirection: 'row', marginBottom: 6 },
    allocHeadText: { fontSize: 10, fontWeight: '700', color: tokens.colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 },
    dim: { fontSize: 12, color: tokens.colors.textDim },
    mapBtn: { marginTop: 14, backgroundColor: tokens.colors.accent, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    mapBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
    actionsCard: {},
    actionsRow: { flexDirection: 'row', gap: 14 },
    actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    approveBtn: { backgroundColor: tokens.colors.accent },
    declineBtn: { backgroundColor: tokens.colors.danger },
    actionText: { fontWeight: '700', fontSize: 14, color: '#000' },
    actionHint: { marginTop: 12, fontSize: 11, color: tokens.colors.textDim },
    disabledBtn: { opacity: 0.5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalBox: { width: '100%', backgroundColor: tokens.colors.cardAlt || tokens.colors.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: tokens.colors.border },
    modalTitle: { fontWeight: '700', fontSize: 16, color: tokens.colors.text, marginBottom: 4 },
    modalSub: { fontSize: 12, color: tokens.colors.textDim, marginBottom: 12 },
    modalInput: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, backgroundColor: tokens.colors.card, padding: 12, color: tokens.colors.text, minHeight: 90, textAlignVertical: 'top', marginBottom: 16, fontSize: 13 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: tokens.colors.border },
    modalDeclineBtn: { backgroundColor: tokens.colors.danger },
    modalCancelBtn: { backgroundColor: tokens.colors.accent },
    modalBtnText: { fontWeight: '700', fontSize: 13, color: '#000' },
    closeIcon: { position: 'absolute', top: 10, right: 10 },
    mapEmbedWrapper: { height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: '#000' },
    mapWebView: { flex: 1 },
    inlineMapOpen: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    inlineMapOpenText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    approveInput: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: tokens.colors.text, backgroundColor: tokens.colors.card, marginBottom: 14 },
    locationHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    toggleLink: { fontSize: 12, color: tokens.colors.accent, fontWeight: '600' },
});