import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { SkeletonCard } from '../../src/ui/components/SkeletonBlock';
import { tokens } from '../../src/ui/tokens';
import ApprovalItemCard from '../../src/ui/components/ApprovalItemCard';
import { onPaymentUpdate } from '../../src/events/paymentEvents';

export default function AccountantNotifyScreen() {
    const [search, setSearch] = useState('');
    const [approvalItems, setApprovalItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalAction, setModalAction] = useState(null);
    const [modalItem, setModalItem] = useState(null);
    const [modalComment, setModalComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [actionSubmittingId, setActionSubmittingId] = useState(null);

    const filteredItems = approvalItems.filter(item =>
        item.company_code.toLowerCase().includes(search.toLowerCase()) ||
        (item.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.company_area || '').toLowerCase().includes(search.toLowerCase())
    );

    const fetchApprovalData = async () => {
        try {
            const t = await StorageService.getToken();
            const baseHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t.access_token}` };
            const r = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/accountant/payments/pending`, { method: 'GET', headers: baseHeaders });
            if (!r.ok) throw new Error('HTTP');
            const data = await r.json();
            const items = data.items || [];
            // Enrich with company name + area
            const enriched = await Promise.all(items.map(async p => {
                try {
                    const cr = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/companies/${p.company_code}`, { headers: baseHeaders });
                    if (cr.ok) {
                        const c = await cr.json();
                        return { ...p, company_name: c.name, company_area: c.area };
                    }
                } catch (_) { }
                return { ...p };
            }));
            setApprovalItems(enriched);
        } catch (e) {
            console.error(e); Alert.alert('Fetch Error', 'Failed to load approval items.');
        } finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { fetchApprovalData(); }, []);

    // Live update from detail screen actions
    useEffect(() => {
        const off = onPaymentUpdate(ev => {
            if (!ev || !ev.id) return;
            setApprovalItems(items => items.filter(i => i.id !== ev.id));
        });
        return off;
    }, []);

    const onRefresh = () => { setRefreshing(true); fetchApprovalData(); };

    const handleApprove = (item) => { (async () => { setActionSubmittingId(item.id); try { const t = await StorageService.getToken(); const r = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/accountant/payments/${item.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t?.access_token}` } }); if (!r.ok) throw new Error('HTTP'); await r.json(); setApprovalItems(p => p.filter(i => i.id !== item.id)); } catch (e) { console.error(e); Alert.alert('Approve Failed', 'Failed to approve.'); } finally { setActionSubmittingId(null); } })(); };

    const handleReject = (item) => { setModalAction('reject'); setModalItem(item); setModalComment(''); setModalVisible(true); };

    const handleModalSubmit = async () => { if (!modalItem) return; setSubmitting(true); try { const t = await StorageService.getToken(); const comment = encodeURIComponent(modalComment.trim() || ''); const url = `${process.env.EXPO_PUBLIC_APP_URI}/accountant/payments/${modalItem.id}/decline?comment=${comment}`; const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t?.access_token}` } }); if (!r.ok) throw new Error('HTTP'); await r.json(); setModalVisible(false); setApprovalItems(p => p.filter(i => i.id !== modalItem.id)); } catch (e) { console.error(e); Alert.alert('Action Failed', 'Failed to reject payment.'); } finally { setSubmitting(false); } };

    const renderItem = ({ item }) => (
        <ApprovalItemCard
            item={item}
            onApprove={handleApprove}
            onReject={handleReject}
            actionLoadingId={actionSubmittingId}
            submitting={submitting}
        />
    );

    return (
        <Screen title="Accountant Approvals" subtitle={`${filteredItems.length} pending`}>
            <Card style={styles.searchCard}>
                <View style={styles.searchRow}>
                    <Ionicons name="search" color={tokens.colors.textDim} size={18} style={{ marginRight: 6 }} />
                    <TextInput style={styles.searchInput} placeholder="Search by company or executive" placeholderTextColor={tokens.colors.textDim} value={search} onChangeText={setSearch} />
                    <TouchableOpacity onPress={onRefresh} disabled={refreshing}><Ionicons name="refresh" size={20} color={tokens.colors.accent} style={refreshing ? { opacity: 0.5 } : {}} /></TouchableOpacity>
                </View>
            </Card>
            {loading ? (
                <View style={{ marginTop: 10 }}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    ListEmptyComponent={<Text style={styles.empty}>{search ? 'No matches found.' : 'No pending approvals.'}</Text>}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ paddingBottom: 60 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
            <Modal visible={modalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Reject Payment</Text>
                        <Text style={styles.modalSub}>{modalItem ? `${modalItem.company_code} • ${parseFloat(modalItem.amount_collected).toFixed(2)}` : ''}</Text>
                        <TextInput style={styles.modalInput} value={modalComment} onChangeText={setModalComment} placeholder="Add a comment..." placeholderTextColor={tokens.colors.textSubtle} multiline editable={!submitting} />
                        <TouchableOpacity style={[styles.submitBtn, submitting && styles.disabledBtn]} onPress={handleModalSubmit} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit</Text>}</TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)} disabled={submitting}><Ionicons name="close-circle" size={30} color={tokens.colors.danger} /></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    searchCard: { marginBottom: 20, padding: 10 },
    searchRow: { flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, paddingVertical: 8, color: tokens.colors.accent, fontSize: 14 },
    empty: { color: tokens.colors.textDim, fontSize: 15, textAlign: 'center', marginTop: 40 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalBox: { width: '100%', backgroundColor: tokens.colors.cardAlt, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: tokens.colors.border },
    modalTitle: { fontWeight: '700', fontSize: 16, color: tokens.colors.text, marginBottom: 6 },
    modalSub: { fontSize: 13, color: tokens.colors.textDim, marginBottom: 12 },
    modalInput: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, backgroundColor: tokens.colors.card, padding: 12, color: tokens.colors.text, minHeight: 90, textAlignVertical: 'top', marginBottom: 16, fontSize: 13 },
    submitBtn: { backgroundColor: tokens.colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    disabledBtn: { opacity: 0.5 },
    closeBtn: { position: 'absolute', top: 10, right: 10 },
});