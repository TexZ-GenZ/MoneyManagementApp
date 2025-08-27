import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Switch, ScrollView } from 'react-native';
import { getErrorMessage } from '../../src/utils/helpers';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { API_BASE_URL } from '../../src/utils/constants';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../../src/services/storageService';
import { useRouter } from 'expo-router';

// Lightweight pill badge
function StatusBadge({ active }) {
    return (
        <View style={[styles.badge, { backgroundColor: active ? 'rgba(76,195,138,0.15)' : 'rgba(255,77,79,0.18)', borderColor: active ? tokens.colors.success : tokens.colors.danger }]}>
            <Text style={[styles.badgeText, { color: active ? tokens.colors.success : tokens.colors.danger }]}>{active ? 'Active' : 'Inactive'}</Text>
        </View>
    );
}

export default function ManageUsers() {
    const router = useRouter();
    const currentUser = useSelector(state => state.auth?.user);
    const [rawUsers, setRawUsers] = useState([]); // full list
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive
    const [roleFilter, setRoleFilter] = useState('all'); // all | executive | accountant | admin
    const [refreshing, setRefreshing] = useState(false);
    const [togglingId, setTogglingId] = useState(null); // still used internally when saving activation changes
    // create form state
    const [createUsername, setCreateUsername] = useState('');
    const [createMobile, setCreateMobile] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createRole, setCreateRole] = useState('executive');
    const [creating, setCreating] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    // edit modal
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [editUsername, setEditUsername] = useState('');
    const [editMobile, setEditMobile] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [savingEdits, setSavingEdits] = useState(false);
    const [editIsActive, setEditIsActive] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [pendingAction, setPendingAction] = useState(null); // 'create' | 'save' | 'delete'
    const [pendingPaymentsMsg, setPendingPaymentsMsg] = useState(null); // { pendingSubmitted, pendingAdmin }
    // Edit modal input focus states (for accent border on focus)
    const [editUsernameFocused, setEditUsernameFocused] = useState(false);
    const [editMobileFocused, setEditMobileFocused] = useState(false);
    const [editPasswordFocused, setEditPasswordFocused] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const h = await StorageService.getAuthHeader();
            const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: { 'Content-Type': 'application/json', ...h } });
            if (!res.ok) throw new Error('Fetch failed');
            const data = await res.json();
            const list = data.items || data || [];
            setRawUsers(list.sort((a, b) => a.username.localeCompare(b.username)));
        } catch (e) {
            console.error(e);
            Alert.alert('Load Failed', getErrorMessage(e));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        let list = [...rawUsers];
        if (statusFilter !== 'all') list = list.filter(u => statusFilter === 'active' ? u.is_active : !u.is_active);
        if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(u => u.username.toLowerCase().includes(q) || (u.mobile || '').toLowerCase().includes(q));
        }
        setFiltered(list);
    }, [rawUsers, search, statusFilter, roleFilter]);

    // Activation now managed inside edit modal save path

    const handleCreate = async () => {
        if (!createUsername.trim() || !createPassword.trim()) {
            Alert.alert('Validation', 'Username & password required.');
            return;
        }
        setCreating(true);
        try {
            const h = await StorageService.getAuthHeader();
            const body = { username: createUsername.trim(), password: createPassword.trim(), mobile: createMobile.trim() || undefined, role: createRole, area: '' };
            const r = await fetch(`${API_BASE_URL}/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
            if (!r.ok) throw new Error('HTTP');
            setCreateModalVisible(false); // close modal immediately
            setCreateUsername(''); setCreateMobile(''); setCreatePassword(''); setCreateRole('executive');
            await fetchUsers(); // refresh list
        } catch (e) { console.error(e); Alert.alert('Create Failed', getErrorMessage(e)); }
        finally { setCreating(false); }
    };

    const openEdit = (u) => { setEditUser(u); setEditUsername(u.username); setEditMobile(u.mobile || ''); setEditPassword(''); setEditIsActive(!!u.is_active); setEditModalVisible(true); };
    const saveEdits = async () => {
        if (!editUser) return; setSavingEdits(true);
        try {
            const h = await StorageService.getAuthHeader();
            // parallel patch calls for changed fields
            const promises = [];
            if (editUsername.trim() && editUsername.trim() !== editUser.username) {
                promises.push(fetch(`${API_BASE_URL}/admin/users/${editUser.id}/username?username=${encodeURIComponent(editUsername.trim())}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h } }));
            }
            if (editMobile.trim() !== (editUser.mobile || '')) {
                promises.push(fetch(`${API_BASE_URL}/admin/users/${editUser.id}/mobile?mobile=${encodeURIComponent(editMobile.trim())}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h } }));
            }
            if (editPassword.trim()) {
                promises.push(fetch(`${API_BASE_URL}/admin/users/${editUser.id}/password?new_password=${encodeURIComponent(editPassword.trim())}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h } }));
            }
            // prevent attempting self-admin deactivation (backend also guards, but we skip the call entirely)
            const isSelfAdmin = currentUser && editUser && String(currentUser.id) === String(editUser.id) && editUser.role === 'admin';
            if (!isSelfAdmin && editIsActive !== editUser.is_active) {
                const endpoint = editIsActive ? 'activate' : 'deactivate';
                promises.push(fetch(`${API_BASE_URL}/admin/users/${editUser.id}/${endpoint}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h } }));
            }
            const responses = await Promise.all(promises);
            if (responses.some(r => !r.ok)) throw new Error('Failed');
            // refetch single user by reloading all to keep code simple
            await fetchUsers();
            setEditModalVisible(false);
        } catch (e) { console.error(e); Alert.alert('Save Failed', getErrorMessage(e)); }
        finally { setSavingEdits(false); }
    };

    const confirmDelete = (u) => {
        // Run a pre-check for assignments and pending payments before attempting delete
        (async () => {
            const blocks = await checkUserDeletionBlocks(u.id);
            const hasAssignments = (blocks?.assignments || 0) > 0;
            const pendingSubmitted = blocks?.pendingSubmitted || 0;
            const pendingAdmin = blocks?.pendingAdmin || 0;
            const hasPending = pendingSubmitted + pendingAdmin > 0;
            if (hasAssignments) {
                Alert.alert(
                    'Cannot Delete — Assignments Found',
                    `${u.username} has ${blocks.assignments} assigned compan${blocks.assignments === 1 ? 'y' : 'ies'}.\n\nUnassign or reassign them before deleting.`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Manage Assignments',
                            onPress: () => router.push({ pathname: '/(others)/CompanyAssignments', params: { execId: String(u.id), preselectAll: '1' } }),
                        },
                    ]
                );
                return;
            }
            if (hasPending) {
                // Show an inline warning in the edit modal instead of navigating away
                if (!editModalVisible) setEditModalVisible(true);
                setPendingPaymentsMsg({ pendingSubmitted, pendingAdmin });
                return;
            }
            // No blocks — proceed with hard delete confirmation
            Alert.alert('Delete User', `Permanently delete ${u.username}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => hardDelete(u) },
            ]);
        })();
    };
    // Helper: deactivate via API
    const safeDeactivate = async (u) => {
        try {
            const h = await StorageService.getAuthHeader();
            const r = await fetch(`${API_BASE_URL}/admin/users/${u.id}/deactivate`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h } });
            if (r.ok) await fetchUsers();
        } catch (e) { }
    };
    // Helper: pre-check user constraints for deletion
    const checkUserDeletionBlocks = async (userId) => {
        try {
            const h = await StorageService.getAuthHeader();
            // 1) assignments for executive (admin can call this)
            const aResp = await fetch(`${API_BASE_URL}/executives/${userId}/companies`, { headers: { 'Content-Type': 'application/json', ...h } });
            let assignments = 0;
            if (aResp.ok) {
                const aj = await aResp.json();
                assignments = (aj?.items || []).length;
            }
            // 2) pending payments for this executive
            let pendingSubmitted = 0, pendingAdmin = 0;
            const p1 = await fetch(`${API_BASE_URL}/accountant/payments/pending?skip=0&limit=500`, { headers: { 'Content-Type': 'application/json', ...h } });
            if (p1.ok) {
                const pj = await p1.json();
                const items = pj?.items || [];
                pendingSubmitted = items.filter(it => String(it.executive_id) === String(userId)).length;
            }
            const p2 = await fetch(`${API_BASE_URL}/admin/payments/pending?skip=0&limit=500`, { headers: { 'Content-Type': 'application/json', ...h } });
            if (p2.ok) {
                const pj = await p2.json();
                const items = pj?.items || [];
                pendingAdmin = items.filter(it => String(it.executive_id) === String(userId)).length;
            }
            return { assignments, pendingSubmitted, pendingAdmin };
        } catch (e) {
            return { assignments: 0, pendingSubmitted: 0, pendingAdmin: 0 };
        }
    };
    const hardDelete = async (u) => {
        setDeletingId(u.id);
        try {
            const h = await StorageService.getAuthHeader();
            const r = await fetch(`${API_BASE_URL}/admin/users/${u.id}/hard-delete`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...h } });
            if (r.status === 400) {
                // Try to get error detail
                let detail = 'Cannot delete user.';
                let hasAssignmentIssue = false;
                try {
                    const err = await r.json();
                    if (err.detail && String(err.detail).toLowerCase().includes('assign')) {
                        detail = err.detail;
                        hasAssignmentIssue = true;
                    } else {
                        detail = err.detail || detail;
                    }
                } catch { }
                if (hasAssignmentIssue) {
                    setEditModalVisible(false);
                    Alert.alert(
                        'Cannot Delete Executive',
                        detail + '\n\nDo you want to unassign/reassign their companies now?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Unassign/Reassign', style: 'default', onPress: () => {
                                    router.push({ pathname: '/(others)/CompanyAssignments', params: { execId: String(u.id), preselectAll: '1' } });
                                }
                            }
                        ]
                    );
                    return;
                }
                Alert.alert('Delete Failed', getErrorMessage(detail));
                return;
            }
            if (!r.ok) throw new Error('Delete failed');
            setEditModalVisible(false); // close modal if open
            await fetchUsers(); // refresh list
        } catch (e) { console.error(e); Alert.alert('Delete Failed', getErrorMessage(e)); }
        finally { setDeletingId(null); }
    };
    useEffect(() => { if (!createModalVisible && !editModalVisible) setPendingAction(null); }, [createModalVisible, editModalVisible]);

    const renderItem = ({ item }) => (
        <Card style={styles.userCard} padded={false}>
            <View style={styles.compactRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${item.username}`} activeOpacity={0.75} onPress={() => openEdit(item)} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
                    <View style={styles.avatar}><Ionicons name="person-outline" size={18} color={tokens.colors.accent} /></View>
                    <View style={styles.compactMain}>
                        <View style={styles.compactTitleLine}>
                            <Text style={styles.username}>{item.username}</Text>
                            <Text style={styles.roleTag}>{item.role}</Text>
                            <View style={styles.statusDotWrap}><View style={[styles.statusDot, { backgroundColor: item.is_active ? tokens.colors.success : tokens.colors.danger }]} /></View>
                        </View>
                        <Text style={styles.metaText}>{item.mobile || '—'}{item.area ? `  •  ${item.area}` : ''}</Text>
                    </View>
                </TouchableOpacity>
                {item.role === 'executive' && (
                    <TouchableOpacity
                        style={styles.assignCompaniesBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Go assign companies to ${item.username}`}
                        onPress={() => router.push({ pathname: '/(others)/CompanyAssignments', params: { execId: String(item.id) } })}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="git-branch-outline" size={16} color={tokens.colors.accent} />
                        <Text style={styles.assignCompaniesBtnText}>Assign</Text>
                    </TouchableOpacity>
                )}
                <Ionicons style={{ marginLeft: 8 }} name="chevron-forward" size={18} color={tokens.colors.textFaint} />
            </View>
        </Card>
    );

    return (
        <Screen title="Manage Users" subtitle="Unified user management">
            <FlatList
                data={filtered}
                keyExtractor={i => i.id.toString()}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                ListEmptyComponent={!loading && <Card><Text style={{ color: tokens.colors.textDim }}>No users found.</Text></Card>}
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchUsers(); }}
                ListHeaderComponent={
                    <View>
                        <Card style={{ marginBottom: 16 }}>
                            <View style={styles.searchRow}>
                                <Ionicons name="search" size={16} color={tokens.colors.accent} style={{ marginRight: 8 }} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder="Search username or mobile"
                                    placeholderTextColor={tokens.colors.textDim}
                                    style={styles.searchInput}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    returnKeyType="search"
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={tokens.colors.textFaint} /></TouchableOpacity>
                                )}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent} style={{ marginTop: 12 }}>
                                <Text style={styles.filterGroupLabel}>Status:</Text>
                                {['all', 'active', 'inactive'].map(f => (
                                    <TouchableOpacity key={`st-${f}`} style={[styles.filterChip, statusFilter === f && styles.filterChipActive]} onPress={() => setStatusFilter(f)}>
                                        <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                                    </TouchableOpacity>
                                ))}
                                <Text style={styles.filterGroupLabel}>Role:</Text>
                                {['all', 'executive', 'accountant', 'admin'].map(f => (
                                    <TouchableOpacity key={`rl-${f}`} style={[styles.filterChip, roleFilter === f && styles.filterChipActive]} onPress={() => setRoleFilter(f)}>
                                        <Text style={[styles.filterChipText, roleFilter === f && styles.filterChipTextActive]}>{f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={[styles.filterChip, styles.resetChip]} onPress={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}>
                                    <Ionicons name="close" size={14} color={tokens.colors.textDim} />
                                    <Text style={[styles.filterChipText, { marginLeft: 4 }]}>Clear</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.filterChip, styles.refreshChip]} onPress={() => { setRefreshing(true); fetchUsers(); }} disabled={loading}>
                                    <Ionicons name="refresh" size={16} color={tokens.colors.accent} />
                                </TouchableOpacity>
                            </ScrollView>
                        </Card>
                        {loading && <View style={{ paddingVertical: 30 }}><ActivityIndicator color={tokens.colors.accent} /></View>}
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 140 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            />
            <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
                <Ionicons name="add" size={28} color="#000" />
            </TouchableOpacity>
            {/* Create Modal */}
            <Modal transparent visible={createModalVisible} animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add User</Text>
                        <TextInput value={createUsername} onChangeText={setCreateUsername} placeholder="Username" placeholderTextColor={tokens.colors.textDim} style={styles.modalInput} />
                        <TextInput value={createMobile} onChangeText={setCreateMobile} placeholder="Mobile (optional)" placeholderTextColor={tokens.colors.textDim} style={styles.modalInput} keyboardType="phone-pad" />
                        <TextInput value={createPassword} onChangeText={setCreatePassword} placeholder="Password" placeholderTextColor={tokens.colors.textDim} style={styles.modalInput} secureTextEntry />
                        <View style={styles.roleChipsRow}>
                            {['executive', 'accountant', 'admin'].map(r => (
                                <TouchableOpacity key={r} onPress={() => setCreateRole(r)} style={[styles.roleChip, createRole === r && styles.roleChipActive]}>
                                    <Text style={[styles.roleChipText, createRole === r && styles.roleChipTextActive]}>{r[0].toUpperCase() + r.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.modalButtonsRow}>
                            {pendingAction === 'create' && (
                                <TouchableOpacity onPress={() => setPendingAction(null)} style={[styles.modalBtn, styles.modalCancel]}><Text style={styles.modalCancelText}>No</Text></TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={[styles.modalBtn, styles.modalCancel]}><Text style={styles.modalCancelText}>{pendingAction === 'create' ? 'Cancel' : 'Close'}</Text></TouchableOpacity>
                            <TouchableOpacity
                                disabled={creating}
                                onPress={() => { pendingAction === 'create' ? handleCreate() : setPendingAction('create'); }}
                                style={[styles.modalBtn, styles.modalSave, pendingAction === 'create' && styles.modalConfirm]}
                            >
                                {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.modalSaveText}>{pendingAction === 'create' ? 'Yes, Create' : 'Create'}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Edit Modal */}
            <Modal transparent visible={editModalVisible} animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Edit User</Text>
                        <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>Username</Text>
                            <TextInput
                                value={editUsername}
                                onChangeText={setEditUsername}
                                placeholder="Username"
                                placeholderTextColor={tokens.colors.textSubtle}
                                selectionColor={tokens.colors.accent}
                                onFocus={() => setEditUsernameFocused(true)}
                                onBlur={() => setEditUsernameFocused(false)}
                                style={[styles.editModalInput, editUsernameFocused && styles.editModalInputFocused]}
                            />
                        </View>
                        <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>Mobile</Text>
                            <TextInput
                                value={editMobile}
                                onChangeText={setEditMobile}
                                placeholder="Mobile"
                                placeholderTextColor={tokens.colors.textSubtle}
                                selectionColor={tokens.colors.accent}
                                keyboardType="phone-pad"
                                onFocus={() => setEditMobileFocused(true)}
                                onBlur={() => setEditMobileFocused(false)}
                                style={[styles.editModalInput, editMobileFocused && styles.editModalInputFocused]}
                            />
                        </View>
                        <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>New Password (optional)</Text>
                            <TextInput
                                value={editPassword}
                                onChangeText={setEditPassword}
                                placeholder="New Password"
                                placeholderTextColor={tokens.colors.textSubtle}
                                selectionColor={tokens.colors.accent}
                                secureTextEntry
                                onFocus={() => setEditPasswordFocused(true)}
                                onBlur={() => setEditPasswordFocused(false)}
                                style={[styles.editModalInput, editPasswordFocused && styles.editModalInputFocused]}
                            />
                        </View>
                        {(() => { const isSelfAdmin = currentUser && editUser && String(currentUser.id) === String(editUser.id) && editUser.role === 'admin'; return !isSelfAdmin; })() ? (
                            <>
                                <View style={styles.activeRow}>
                                    <StatusBadge active={editIsActive} />
                                    <Switch
                                        value={editIsActive}
                                        onValueChange={setEditIsActive}
                                        trackColor={{ false: '#444', true: tokens.colors.accent }}
                                        thumbColor={editIsActive ? '#000' : '#777'}
                                        style={{ marginLeft: 12 }}
                                    />
                                    <Text style={styles.activeHint}>{editIsActive ? 'Toggle to deactivate user' : 'Toggle to activate user'}</Text>
                                </View>
                                {editUser?.role === 'executive' && (
                                    <TouchableOpacity
                                        style={styles.inlineAssignBtn}
                                        onPress={() => { setEditModalVisible(false); router.push({ pathname: '/(others)/CompanyAssignments', params: { execId: String(editUser.id) } }); }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Assign companies to this executive"
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="git-branch-outline" size={16} color={tokens.colors.accent} style={{ marginRight: 6 }} />
                                        <Text style={styles.inlineAssignText}>Assign Companies</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    disabled={deletingId === editUser?.id}
                                    onPress={() => { pendingAction === 'delete' ? confirmDelete(editUser) : setPendingAction('delete'); }}
                                    style={[styles.deleteDangerBtn, pendingAction === 'delete' && styles.deleteDangerConfirm, pendingPaymentsMsg && styles.deleteDisabled]}
                                >
                                    {deletingId === editUser?.id ? <ActivityIndicator size="small" color="#fff" /> : (
                                        <Text style={[styles.deleteDangerText, pendingPaymentsMsg && styles.deleteDisabledText]}>
                                            {pendingPaymentsMsg ? 'Resolve pending to delete' : (pendingAction === 'delete' ? 'Confirm Delete?' : 'Delete User')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        ) : (
                            <Text style={styles.selfNote}>Admin account stays active and cannot be deleted.</Text>
                        )}
                        <View style={styles.modalButtonsRow}>
                            {pendingAction === 'save' && (
                                <TouchableOpacity onPress={() => setPendingAction(null)} style={[styles.modalBtn, styles.modalCancel]}><Text style={styles.modalCancelText}>No</Text></TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={[styles.modalBtn, styles.modalCancel]}><Text style={styles.modalCancelText}>{pendingAction === 'save' ? 'Cancel' : 'Close'}</Text></TouchableOpacity>
                            <TouchableOpacity
                                disabled={savingEdits}
                                onPress={() => { pendingAction === 'save' ? saveEdits() : setPendingAction('save'); }}
                                style={[styles.modalBtn, styles.modalSave, pendingAction === 'save' && styles.modalConfirm]}
                            >
                                {savingEdits ? <ActivityIndicator color="#000" /> : <Text style={styles.modalSaveText}>{pendingAction === 'save' ? 'Yes, Save' : 'Save'}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Pending Payments Modal */}
            <Modal transparent visible={!!pendingPaymentsMsg} animationType="fade" onRequestClose={() => setPendingPaymentsMsg(null)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, styles.modalCardWarn]}>
                        <View style={styles.warnBox}>
                            <Text style={styles.warnTitle}>Pending payments detected</Text>
                            <Text style={[styles.warnText, { marginBottom: 8 }]}>Finish pending payments first, or deactivate the user.</Text>
                            <View style={styles.warnChipsRow}>
                                {!!pendingPaymentsMsg?.pendingSubmitted && pendingPaymentsMsg.pendingSubmitted > 0 && (
                                    <View style={[styles.warnChip, styles.warnChipNeutral]}>
                                        <Text style={styles.warnChipText}>{pendingPaymentsMsg.pendingSubmitted} awaiting accountant</Text>
                                    </View>
                                )}
                                {!!pendingPaymentsMsg?.pendingAdmin && pendingPaymentsMsg.pendingAdmin > 0 && (
                                    <View style={[styles.warnChip, styles.warnChipNeutral]}>
                                        <Text style={styles.warnChipText}>{pendingPaymentsMsg.pendingAdmin} awaiting admin</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={[styles.warnButtonsRow, { marginTop: 12 }]}>
                            <TouchableOpacity onPress={() => setPendingPaymentsMsg(null)} style={[styles.modalBtn, styles.modalCancel]}>
                                <Text style={styles.modalCancelText}>Finish payments</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={async () => { await safeDeactivate(editUser); setPendingPaymentsMsg(null); setEditModalVisible(false); }} style={[styles.modalBtn, styles.deactivateDangerBtn]}>
                                <Text style={styles.deactivateDangerText}>Deactivate now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    searchRow: { flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: tokens.colors.text, fontSize: 14 },
    filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    filterScrollContent: { alignItems: 'center', paddingRight: 8 },
    filterGroupLabel: { color: tokens.colors.textFaint, fontSize: 12, marginRight: 6, marginLeft: 4 },
    resetChip: { backgroundColor: tokens.colors.cardAlt },
    refreshChip: { backgroundColor: tokens.colors.cardAlt },
    filterChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: tokens.colors.cardAlt, marginRight: 8, borderWidth: 1, borderColor: tokens.colors.border },
    filterChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
    filterChipText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '500' },
    filterChipTextActive: { color: '#000', fontWeight: '600' },
    refreshBtn: { marginLeft: 'auto', padding: 8, borderRadius: 12, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border },
    userCard: { paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.md },
    rowUpper: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    userMain: { flex: 1 },
    username: { color: tokens.colors.text, fontWeight: '600', fontSize: 15 },
    metaText: { color: tokens.colors.textDim, fontSize: 12, marginTop: 2 },
    userTitleRow: { flexDirection: 'row', alignItems: 'center' },
    roleTag: { marginLeft: 8, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, color: tokens.colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    compactRow: { flexDirection: 'row', alignItems: 'center' },
    compactMain: { flex: 1 },
    compactTitleLine: { flexDirection: 'row', alignItems: 'center' },
    statusDotWrap: { marginLeft: 8 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    activeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    activeLabel: { color: tokens.colors.textDim, fontSize: 13 },
    activeHint: { marginLeft: 10, color: tokens.colors.textDim, fontSize: 11 },
    deleteDangerBtn: { backgroundColor: tokens.colors.danger, paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    deleteDangerText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    deleteDisabled: { opacity: 0.6 },
    deleteDisabledText: { color: '#ddd' },
    badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, marginLeft: 8 },
    badgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
    smallBtn: { marginLeft: 8, padding: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
    assignCompaniesBtn: { marginLeft: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: tokens.colors.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
    assignCompaniesBtnText: { marginLeft: 4, color: tokens.colors.textDim, fontSize: 11, fontWeight: '600' },
    inlineAssignBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.cardAlt, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 12 },
    inlineAssignText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
    sectionHeading: { color: tokens.colors.text, fontWeight: '600', marginBottom: 8, fontSize: 15 },
    createRowGroup: {},
    createInput: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: tokens.colors.text, fontSize: 14, marginBottom: 10 },
    fab: { position: 'absolute', bottom: 30, right: 24, backgroundColor: tokens.colors.accent, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
    roleChipsRow: { flexDirection: 'row', marginBottom: 10 },
    roleChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: tokens.colors.cardAlt, marginRight: 8, borderWidth: 1, borderColor: tokens.colors.border },
    roleChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
    roleChipText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '500' },
    roleChipTextActive: { color: '#000', fontWeight: '600' },
    createBtn: { backgroundColor: tokens.colors.accent, paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 4 },
    createBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: tokens.colors.card, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: tokens.colors.border },
    modalCardWarn: { borderWidth: 2, borderColor: tokens.colors.warning },
    modalTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
    modalInput: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: tokens.colors.text, fontSize: 14, marginBottom: 10 },
    // New: dedicated style for Edit modal inputs to ensure consistent color + focus affordance
    editModalInput: {
        backgroundColor: tokens.colors.cardAlt || '#0d0d0d',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: tokens.colors.text,
        fontSize: 14,
        marginBottom: 10,
    },
    editModalInputFocused: {
        borderColor: tokens.colors.accent,
        shadowColor: tokens.colors.accent,
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
    },
    fieldBlock: { marginBottom: 4 },
    fieldLabel: { color: tokens.colors.textDim, fontSize: 12, marginBottom: 4, marginLeft: 4 },
    modalButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
    modalBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
    modalCancel: { backgroundColor: tokens.colors.cardAlt, marginRight: 10 },
    modalSave: { backgroundColor: tokens.colors.accent },
    modalConfirm: { backgroundColor: tokens.colors.warning },
    modalCancelText: { color: tokens.colors.text, fontWeight: '500' },
    modalSaveText: { color: '#000', fontWeight: '600' },
    selfNote: { color: tokens.colors.warning, fontSize: 11, marginTop: -4, marginBottom: 10 },
    deleteDangerConfirm: { backgroundColor: '#b71c1c' },
    deactivateDangerBtn: { backgroundColor: tokens.colors.danger, marginLeft: 10 },
    deactivateDangerText: { color: '#fff', fontWeight: '700' },
    warnBox: { borderWidth: 2, borderColor: tokens.colors.warning, backgroundColor: tokens.colors.cardAlt, borderRadius: 12, padding: 12, marginBottom: 12 },
    warnTitle: { color: tokens.colors.warning, fontWeight: '700', marginBottom: 4, fontSize: 13 },
    warnText: { color: tokens.colors.textDim, fontSize: 12 },
    warnChipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
    warnChip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1 },
    warnChipNeutral: { borderColor: tokens.colors.border, backgroundColor: tokens.colors.cardAlt },
    warnChipText: { color: tokens.colors.textDim, fontSize: 11, fontWeight: '600' },
    warnButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
});
