import React, { useEffect, useState, useRef } from 'react';
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
import { formatCurrency, formatDate, formatDateTime } from '../../src/ui/format';
import { Picker } from '@react-native-picker/picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const paymentMethods = ['Cash', 'UPI', 'Cheque', 'Bank Transfer'];

import { API_BASE_URL } from '../../src/utils/constants';

export default function PaymentApprovalDetail() {
    const { payment_id, read_only } = useLocalSearchParams();
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
    // Edit mode states
    const [editing, setEditing] = useState(false);
    const [editAmount, setEditAmount] = useState('');
    const [editMethod, setEditMethod] = useState(paymentMethods[0]);
    const [editComment, setEditComment] = useState('');
    const [editCollectedAt, setEditCollectedAt] = useState(new Date());
    const [editNextPromiseDate, setEditNextPromiseDate] = useState(null);
    const [isEditCollectedAtPickerVisible, setEditCollectedAtPickerVisible] = useState(false);
    const [isEditPromisePickerVisible, setEditPromisePickerVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const scrollViewRef = useRef(null);
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
            const isAdminAction = currentUser?.role === 'admin' && (payment.status === 'accountant_approved' || payment.status === 'submitted');
            const base = isAdminAction ? 'admin' : 'accountant';
            const url = `${API_BASE_URL}/${base}/payments/${payment.id}/approve${comment ? `?comment=${comment}` : ''}`;
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t.access_token}` } : {}) } });
            if (!r.ok) throw new Error('Approve failed');
            const updated = await r.json().catch(() => null);
            // Optimistic local update
            const newStatus = isAdminAction ? 'admin_approved' : 'accountant_approved';
            setPayment(p => p ? {
                ...p,
                status: newStatus,
                [isAdminAction ? 'admin_comment' : 'accountant_comment']:
                    approveComment || p[isAdminAction ? 'admin_comment' : 'accountant_comment'],
            } : p);
            emitPaymentUpdate({ id: payment.id, status: newStatus });
            // Navigate back to list immediately (no need to stay)
            router.back();
            setApproveComment('');
        } catch (e) {
            Alert.alert('Error', 'Failed to approve payment');
        } finally { setApproving(false); }
    };

    // Ask for confirmation before approving
    const confirmApprove = () => {
        if (!payment || approving || declining) return;
        const isAdminAction = currentUser?.role === 'admin' && (payment.status === 'accountant_approved' || payment.status === 'submitted');
        const title = 'Confirm Approval';
        const amountLabel = (Number(payment?.amount_collected) === 0 && payment?.next_promise_date) ? 'Change in promise date' : formatCurrency(payment?.amount_collected || 0);
        const subtitle = `${isAdminAction ? 'Admin' : 'Accountant'} approval for ${payment?.company_code || 'payment'} • ${amountLabel}\n\nAre you sure?`;
        Alert.alert(title, subtitle, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Approve', style: 'default', onPress: () => handleApprove() },
        ]);
    };

    const handleDecline = () => { setDeclineVisible(true); setDeclineComment(''); };

    const submitDecline = async () => {
        if (!payment) return; setDeclining(true);
        try {
            const t = await StorageService.getToken();
            const comment = encodeURIComponent((declineComment || '').trim());
            const isAdminAction = currentUser?.role === 'admin' && (payment.status === 'accountant_approved' || payment.status === 'submitted');
            const base = isAdminAction ? 'admin' : 'accountant';
            const r = await fetch(`${API_BASE_URL}/${base}/payments/${payment.id}/decline?comment=${comment}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t.access_token}` } : {}) } });
            if (!r.ok) throw new Error('Decline failed');
            await r.json().catch(() => null);
            const newStatus = isAdminAction ? 'declined_by_admin' : 'declined_by_accountant';
            setPayment(p => p ? {
                ...p,
                status: newStatus,
                [isAdminAction ? 'admin_comment' : 'accountant_comment']:
                    declineComment || p[isAdminAction ? 'admin_comment' : 'accountant_comment'],
            } : p);
            emitPaymentUpdate({ id: payment.id, status: newStatus });
            setDeclineVisible(false);
            // Return to list
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to decline payment');
        } finally { setDeclining(false); }
    };

    const isReadOnly = String(read_only || '') === '1';
    const paymentStatus = payment?.status;
    const isAdminUser = currentUser?.role === 'admin';
    const isAccountantUser = currentUser?.role === 'accountant';
    const isExecutiveUser = currentUser?.role === 'executive';
    const canAdminAct = !isReadOnly && isAdminUser && (paymentStatus === 'accountant_approved' || paymentStatus === 'submitted');
    const canAccountantAct = !isReadOnly && isAccountantUser && paymentStatus === 'submitted';
    const canAct = canAdminAct || canAccountantAct;
    const canEdit = !isReadOnly && (isExecutiveUser || isAccountantUser || isAdminUser)
        && (paymentStatus === 'submitted' || paymentStatus === 'accountant_approved' || paymentStatus === 'admin_approved');

    // -- Edit mode handlers --
    const startEditing = () => {
        if (!payment) return;
        setEditAmount(String(payment.amount_collected || ''));
        setEditMethod(
            paymentMethods.find(m => m.toLowerCase() === (payment.method || '').toLowerCase())
            || paymentMethods[0]
        );
        setEditComment(payment.comments || '');
        setEditCollectedAt(payment.collected_at ? new Date(payment.collected_at) : new Date());
        setEditNextPromiseDate(payment.next_promise_date ? new Date(payment.next_promise_date) : null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setSaving(false);
        setDeleting(false);
    };

    const handleSave = async () => {
        if (!payment || saving) return;
        const amt = Number(editAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Invalid', 'Enter a valid amount.');
            return;
        }
        if (amt < 100) {
            Alert.alert('Amount Too Small', 'Minimum payment amount is ₹1.00 (enter 100 or more).');
            return;
        }
        setSaving(true);
        try {
            const t = await StorageService.getToken();
            const payload = {
                amount_collected: amt,
                method: editMethod.toLowerCase(),
                collected_at: editCollectedAt.toISOString(),
                comments: editComment.trim() || null,
                next_promise_date: editNextPromiseDate
                    ? editNextPromiseDate.toISOString().slice(0, 10)
                    : null,
            };
            const r = await fetch(`${API_BASE_URL}/accountant/payments/${payment.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${t.access_token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!r.ok) {
                const errData = await r.json().catch(() => ({}));
                throw new Error(errData.detail || 'Update failed');
            }
            const updated = await r.json();
            setPayment(updated);
            setEditing(false);
            emitPaymentUpdate({ id: payment.id, status: updated.status });
            Alert.alert('Saved', 'Payment updated successfully.');
        } catch (e) {
            Alert.alert('Error', String(e.message || 'Failed to update payment'));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = () => {
        if (!payment || deleting) return;
        const amtLabel = (Number(payment.amount_collected) === 0 && payment.next_promise_date)
            ? 'Change in promise date'
            : formatCurrency(payment.amount_collected || 0);
        Alert.alert(
            'Delete Payment',
            `Delete payment for ${payment.company_code} • ${amtLabel}?\n\nThis cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete() },
            ]
        );
    };

    const handleDelete = async () => {
        if (!payment || deleting) return;
        setDeleting(true);
        try {
            const t = await StorageService.getToken();
            const r = await fetch(`${API_BASE_URL}/accountant/payments/${payment.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${t.access_token}`,
                },
            });
            if (!r.ok && r.status !== 204) {
                const errData = await r.json().catch(() => ({}));
                throw new Error(errData.detail || 'Delete failed');
            }
            emitPaymentUpdate({ id: payment.id, status: 'deleted' });
            router.back();
        } catch (e) {
            Alert.alert('Error', String(e.message || 'Failed to delete payment'));
        } finally {
            setDeleting(false);
        }
    };

    // Scroll to 70% of content height when approval comment input is focused
    const handleApproveInputFocus = () => {
        if (scrollViewRef.current) {
            scrollViewRef.current.measure?.((x, y, width, height, pageX, pageY) => {
                // fallback if measure is not available
            });
            scrollViewRef.current.scrollTo?.({ y: scrollViewContentHeight * 0.7, animated: true });
        }
    };
    const [scrollViewContentHeight, setScrollViewContentHeight] = useState(0);
    return (
        <Screen title={company?.name || (payment ? payment.company_code : 'Payment')}>
            {loading ? <ActivityIndicator color={tokens.colors.accent} style={{ marginTop: 40 }} /> : (
                <ScrollView
                    ref={scrollViewRef}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    scrollEnabled={outerScrollEnabled}
                    onContentSizeChange={(w, h) => setScrollViewContentHeight(h)}
                >
                    <Card style={[styles.card, styles.headerCard]}>
                        <View style={styles.headerTopLine}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.companyName} numberOfLines={2}>{company?.name || payment?.company_code || 'Payment'}</Text>
                                <View style={styles.companyMetaRow}>
                                    {payment?.company_code && <Text style={styles.companyCode}>{payment.company_code}</Text>}
                                    {company?.area && <Text style={styles.companyArea}> • {company.area}</Text>}
                                </View>
                                {(executive?.username || executive?.full_name || executive?.name) && (
                                    <View style={styles.execBlock} accessibilityRole="text" accessibilityLabel={`Executive ${executive?.full_name || executive?.name || executive?.username}`}>
                                        <Text style={styles.execLabel}>EXECUTIVE</Text>
                                        <Text style={styles.execNameBig} numberOfLines={1}>{executive?.full_name || executive?.name || executive?.username}</Text>
                                    </View>
                                )}
                                {payment?.allocations?.length ? (
                                    <Text style={styles.bigLine} numberOfLines={1}>
                                        Bill {payment.allocations.filter(a => a.bill_number).length > 1 ? 'IDs' : 'ID'}: {payment.allocations.filter(a => a.bill_number).map(a => a.bill_number).slice(0, 4).join(', ')}{payment.allocations.filter(a => a.bill_number).length > 4 ? ` +${payment.allocations.filter(a => a.bill_number).length - 4}` : ''}
                                    </Text>
                                ) : null}
                                {payment.next_promise_date && (
                                    <Text style={styles.bigLine}>Promise: {formatDate(payment.next_promise_date)}</Text>
                                )}
                                {payment?.status ? (
                                    <View style={styles.statusBelow}>
                                        <StatusBadge status={payment.status} />
                                    </View>
                                ) : null}
                            </View>
                            {!editing ? (
                                <View style={styles.amountStatusCol}>
                                    <Text style={[styles.amount, (Number(payment.amount_collected) === 0 && payment.next_promise_date) && styles.amountPromise]}>
                                        {(Number(payment.amount_collected) === 0 && payment.next_promise_date) ? 'Change in\npromise date' : formatCurrency(payment.amount_collected)}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        {!editing ? (
                            <View style={styles.metaGrid}>
                                <Meta label="Collected" value={formatDateTime(payment.collected_at)} />
                                <Meta label="Method" value={payment.method} />
                            </View>
                        ) : (
                            <View style={{ marginTop: 8 }}>
                                <Text style={styles.fieldLabel}>Amount Collected</Text>
                                <TextInput
                                    style={styles.editInput}
                                    keyboardType="numeric"
                                    value={editAmount}
                                    onChangeText={setEditAmount}
                                    placeholder="Enter amount"
                                    placeholderTextColor={tokens.colors.textFaint}
                                />
                                <Text style={styles.fieldLabel}>Payment Method</Text>
                                <View style={styles.pickerShell}>
                                    <Picker
                                        selectedValue={editMethod}
                                        onValueChange={setEditMethod}
                                        style={styles.picker}
                                    >
                                        {paymentMethods.map(m => <Picker.Item key={m} label={m} value={m} />)}
                                    </Picker>
                                </View>
                                <Text style={styles.fieldLabel}>Collected At</Text>
                                <TouchableOpacity onPress={() => setEditCollectedAtPickerVisible(true)} style={styles.fieldBtn}>
                                    <Text style={styles.fieldBtnText}>{formatDateTime(editCollectedAt)}</Text>
                                </TouchableOpacity>
                                <Text style={styles.fieldLabel}>Next Promise Date</Text>
                                <TouchableOpacity onPress={() => setEditPromisePickerVisible(true)} style={styles.fieldBtn}>
                                    <Text style={styles.fieldBtnText}>{editNextPromiseDate ? formatDate(editNextPromiseDate) : 'None'}</Text>
                                </TouchableOpacity>
                                <Text style={styles.fieldLabel}>Comments</Text>
                                <TextInput
                                    style={[styles.editInput, styles.multilineInput]}
                                    multiline
                                    value={editComment}
                                    onChangeText={setEditComment}
                                    placeholder="Optional notes"
                                    placeholderTextColor={tokens.colors.textFaint}
                                />
                            </View>
                        )}
                        {payment.exec_lat && payment.exec_lng && (
                            <View style={{ marginTop: 14 }}>
                                <View style={styles.locationHeaderRow}>
                                    <Text style={styles.subSectionTitle}>Location</Text>
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
                                                    const zoom = 17;
                                                    const d = 0.0008;
                                                    const bbox = `${(lng - d).toFixed(6)},${(lat - d).toFixed(6)},${(lng + d).toFixed(6)},${(lat + d).toFixed(6)}`;
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
                    {/* Edit / Delete card */}
                    {canEdit && !editing ? (
                        <Card style={[styles.card, styles.actionsCard]}>
                            <Text style={styles.sectionTitle}>Manage Payment</Text>
                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.editBtn]}
                                    onPress={startEditing}
                                >
                                    <Text style={styles.actionText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.deleteBtn]}
                                    onPress={confirmDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionText, { color: '#fff' }]}>Delete</Text>}
                                </TouchableOpacity>
                            </View>
                        </Card>
                    ) : null}
                    {/* Save / Cancel bar when editing */}
                    {editing ? (
                        <Card style={[styles.card, styles.actionsCard]}>
                            <Text style={styles.sectionTitle}>Editing Payment</Text>
                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.editBtn, saving && styles.disabledBtn]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.actionText}>Save Changes</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.deleteBtn]}
                                    onPress={cancelEditing}
                                    disabled={saving}
                                >
                                    <Text style={[styles.actionText, { color: '#fff' }]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    ) : null}
                    {canAct && !editing ? (
                        <Card style={[styles.card, styles.actionsCard]}>
                            <Text style={styles.sectionTitle}>{canAdminAct ? 'Admin Action' : 'Accountant Action'}</Text>
                            <TextInput
                                style={styles.approveInput}
                                placeholder={canAdminAct ? 'Add admin approval comment (optional)' : 'Add accountant approval comment (optional)'}
                                placeholderTextColor={tokens.colors.textSubtle}
                                value={approveComment}
                                onChangeText={setApproveComment}
                                editable={!approving && !declining}
                                onFocus={handleApproveInputFocus}
                            />
                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.approveBtn, (approving || declining) && styles.disabledBtn]}
                                    onPress={confirmApprove}
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
                                {canAdminAct
                                    ? 'Admin approves or declines payments already reviewed by accountant.'
                                    : 'Accountant initial review stage.'}
                            </Text>
                        </Card>
                    ) : null}
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
                        <Info label="Executive Message" value={(payment?.comments || payment?.executive_comment || payment?.exec_comment || '—')} />
                        <Info label="Accountant Comment" value={(payment?.accountant_comment || '—')} />
                        <Info label="Admin Comment" value={(payment?.admin_comment || '—')} />
                    </Card>
                    <Modal visible={declineVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalBox}>
                                <Text style={styles.modalTitle}>Decline Payment</Text>
                                <Text style={styles.modalSub}>
                                    {payment?.company_code} • {(Number(payment?.amount_collected) === 0 && payment?.next_promise_date) ? 'Change in promise date' : formatCurrency(payment?.amount_collected || 0)}
                                </Text>
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
                    <DateTimePickerModal
                        isVisible={isEditCollectedAtPickerVisible}
                        mode="date"
                        onConfirm={(d) => {
                            const merged = new Date(d);
                            merged.setHours(
                                editCollectedAt.getHours(),
                                editCollectedAt.getMinutes(),
                                editCollectedAt.getSeconds()
                            );
                            setEditCollectedAt(merged);
                            setEditCollectedAtPickerVisible(false);
                        }}
                        onCancel={() => setEditCollectedAtPickerVisible(false)}
                        maximumDate={new Date()}
                    />
                    <DateTimePickerModal
                        isVisible={isEditPromisePickerVisible}
                        mode="date"
                        onConfirm={(d) => {
                            setEditNextPromiseDate(d);
                            setEditPromisePickerVisible(false);
                        }}
                        onCancel={() => setEditPromisePickerVisible(false)}
                        minimumDate={new Date()}
                    />
                </ScrollView>
            )}
        </Screen>
    );
}

function Info({ label, value }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={0}>
                {String(value)}
            </Text>
        </View>
    );
}

function Meta({ label, value }) {
    return (
        <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{String(value)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: 16, padding: 16 },
    headerCard: { marginBottom: 12, paddingBottom: 14 },
    companyName: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
    companyCode: { fontSize: 14, fontWeight: '700', color: tokens.colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 },
    companyArea: { fontSize: 12, fontWeight: '600', color: tokens.colors.textDim },
    execPrimary: { marginTop: 8, fontSize: 16, fontWeight: '700', color: tokens.colors.text }, // legacy (unused after redesign)
    execBlock: { marginTop: 10, marginBottom: 2 },
    execLabel: { fontSize: 10, fontWeight: '700', color: tokens.colors.textSubtle, letterSpacing: 0.6 },
    execNameBig: { marginTop: 2, fontSize: 17, fontWeight: '700', color: tokens.colors.text },
    execName: { marginTop: 6, fontSize: 13, fontWeight: '600', color: tokens.colors.text },
    billList: { marginTop: 6, fontSize: 12, fontWeight: '500', color: tokens.colors.textDim },
    bigLine: { marginTop: 6, fontSize: 14, fontWeight: '600', color: tokens.colors.text },
    statusBelow: { marginTop: 6, alignSelf: 'flex-start' },
    paymentMeta: { marginTop: 4, fontSize: 11, fontWeight: '600', color: tokens.colors.textSubtle, letterSpacing: 0.5 },
    headerTopLine: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    companyMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
    amountStatusCol: { alignItems: 'flex-end', marginLeft: 12 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    metaItem: { width: '50%', paddingRight: 10, marginTop: 6 },
    metaLabel: { fontSize: 10, fontWeight: '700', color: tokens.colors.textSubtle, letterSpacing: 0.5, textTransform: 'uppercase' },
    metaValue: { fontSize: 12, fontWeight: '600', color: tokens.colors.text },
    subSectionTitle: { fontSize: 12, fontWeight: '700', color: tokens.colors.textSubtle, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
    topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    amount: { flex: 1, fontSize: 22, fontWeight: '700', color: tokens.colors.accent },
    amountPromise: { textAlign: 'center', lineHeight: 24 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' },
    infoLabel: { fontSize: 12, color: tokens.colors.textDim, width: 130 },
    infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: tokens.colors.text, marginLeft: 12, flexWrap: 'wrap' },
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
    // Edit mode styles
    fieldLabel: { color: tokens.colors.textDim, fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 10, letterSpacing: 0.5 },
    editInput: { backgroundColor: tokens.colors.cardAlt, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 8 },
    multilineInput: { height: 80, textAlignVertical: 'top' },
    pickerShell: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 8 },
    picker: { color: tokens.colors.text, width: '100%' },
    fieldBtn: { backgroundColor: tokens.colors.cardAlt, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 8 },
    fieldBtnText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
    editBtn: { backgroundColor: tokens.colors.accent },
    deleteBtn: { backgroundColor: tokens.colors.danger },
});
