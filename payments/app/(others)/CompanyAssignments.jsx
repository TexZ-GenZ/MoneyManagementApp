import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useSelector } from 'react-redux';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../../src/services/storageService';

/*
 UX Goals:
 - Independent screen for assigning/unassigning companies to executives.
 - Two tabs: Unassigned pool, Assigned (with current executive shown).
 - Multi-select list; action bar appears when selection > 0.
 - Assign flow: pick an executive from modal, apply to all selected.
 - Unassign flow: removes assignments -> items move to Unassigned pool.
*/

export default function CompanyAssignments() {
    const currentUserRole = useSelector(state => state.auth?.user?.role);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState([]); // all with assignment info
    const [executives, setExecutives] = useState([]);
    // Tab mode like original: 'unassigned' | 'assigned'
    const [tab, setTab] = useState('unassigned');
    const [selected, setSelected] = useState(new Set());
    const [assignModalVisible, setAssignModalVisible] = useState(false);
    const [executiveLoading, setExecutiveLoading] = useState(false);
    const [mutating, setMutating] = useState(false);
    const [companySearch, setCompanySearch] = useState('');
    const [execViewExec, setExecViewExec] = useState(null); // selected executive object when drilling into assigned tab

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const h = await StorageService.getAuthHeader();
            const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/assignments/companies`, { headers: { 'Content-Type': 'application/json', ...h } });
            if (res.ok) {
                const data = await res.json();
                console.log('[Assignments] direct endpoint items sample', data.items?.slice(0, 5));
                const items = data.items || [];
                const anyAssigned = items.some(i => i.assigned_executive_id);
                if (!anyAssigned) {
                    // Attempt raw fallback reconstruction
                    try {
                        const rawRes = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/assignments/raw`, { headers: { 'Content-Type': 'application/json', ...h } });
                        if (rawRes.ok) {
                            const rawData = await rawRes.json();
                            if (rawData.count > 0) {
                                const execListRes = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/users?role=executive&limit=1000`, { headers: { 'Content-Type': 'application/json', ...h } });
                                let execMap = {};
                                if (execListRes.ok) {
                                    const execPayload = await execListRes.json();
                                    (execPayload.items || []).forEach(u => { execMap[u.id] = u; });
                                }
                                const rawMap = {}; rawData.rows.forEach(r => { rawMap[r.company_code] = r.executive_id; });
                                items.forEach(it => {
                                    const eid = rawMap[it.code];
                                    if (eid) {
                                        it.assigned_executive_id = eid;
                                        it.assigned_executive_username = execMap[eid]?.username || null;
                                    }
                                });
                            }
                        }
                    } catch (err) { console.log('[Assignments] raw reconstruction failed', err); }
                }
                // Secondary fallback if still zero but raw shows assignments
                if (!items.some(i => i.assigned_executive_id)) {
                    try {
                        const rawRes2 = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/assignments/raw`, { headers: { 'Content-Type': 'application/json', ...h } });
                        if (rawRes2.ok) {
                            const rawData2 = await rawRes2.json();
                            if (rawData2.count > 0) {
                                console.log('[Assignments] secondary raw fallback engaged');
                                const map2 = {}; rawData2.rows.forEach(r => map2[r.company_code] = r.executive_id);
                                items.forEach(it => { const id = map2[it.code]; if (id) { it.assigned_executive_id = id; } });
                            }
                        }
                    } catch (err) { console.log('[Assignments] secondary fallback failed', err); }
                }
                setCompanies(items);
                return;
            }
            if (res.status === 404) {
                console.log('[Assignments] fallback mode');
                const compRes = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/companies?skip=0&limit=1000`, { headers: { 'Content-Type': 'application/json', ...h } });
                if (!compRes.ok) throw new Error('companies_list');
                const compData = await compRes.json();
                const baseItems = (compData.items || []).map(c => ({ code: c.code, name: c.name, assigned_executive_id: null, assigned_executive_username: null }));
                const execRes = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/executives`, { headers: { 'Content-Type': 'application/json', ...h } });
                if (execRes.ok) {
                    const execs = await execRes.json();
                    const assignmentsMap = {};
                    let anyForbidden = false;
                    await Promise.all(execs.map(async ex => {
                        try {
                            const ecRes = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/executives/${ex.id}/companies`, { headers: { 'Content-Type': 'application/json', ...h } });
                            if (ecRes.status === 403) { anyForbidden = true; return; }
                            if (!ecRes.ok) return;
                            const ecData = await ecRes.json();
                            (ecData.items || []).forEach(co => { assignmentsMap[co.code] = { id: ex.id, username: ex.username }; });
                        } catch (_) { }
                    }));
                    baseItems.forEach(it => { const a = assignmentsMap[it.code]; if (a) { it.assigned_executive_id = a.id; it.assigned_executive_username = a.username; } });
                    if (anyForbidden && currentUserRole !== 'admin') {
                        Alert.alert('Limited View', 'Your role cannot view existing assignments; showing companies as unassigned.');
                    }
                    console.log('[Assignments] fallback composed sample', baseItems.slice(0, 5));
                }
                setCompanies(baseItems);
                return;
            }
            throw new Error('assignments_endpoint');
        } catch (e) { console.error(e); Alert.alert('Error', 'Failed to load companies (assignments).'); }
        finally { setLoading(false); }
    }, [currentUserRole]);

    const fetchExecutives = useCallback(async () => {
        setExecutiveLoading(true);
        try {
            const h = await StorageService.getAuthHeader();
            const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/users?role=executive&limit=500`, { headers: { 'Content-Type': 'application/json', ...h } });
            if (!res.ok) throw new Error('execs');
            const data = await res.json();
            setExecutives((data.items || data || []));
        } catch (e) { console.error(e); Alert.alert('Error', 'Failed to load executives'); }
        finally { setExecutiveLoading(false); }
    }, []);

    useEffect(() => { fetchCompanies(); fetchExecutives(); }, [fetchCompanies, fetchExecutives]);

    const unassigned = companies.filter(c => !c.assigned_executive_id);
    const assigned = companies.filter(c => c.assigned_executive_id);
    const assignedByExec = React.useMemo(() => {
        const map = {};
        assigned.forEach(c => { if (!map[c.assigned_executive_id]) map[c.assigned_executive_id] = []; map[c.assigned_executive_id].push(c); });
        return map;
    }, [assigned]);
    const execSummaries = executives.map(ex => ({
        id: ex.id,
        username: ex.username,
        is_active: ex.is_active,
        count: (assignedByExec[ex.id] || []).length,
    })).filter(e => e.count > 0).sort((a, b) => a.username.localeCompare(b.username));

    // Fuzzy/forgiving search
    const normalize = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const charSeqScore = (q, t) => { // proportion of query chars found in order
        let qi = 0, ti = 0; while (qi < q.length && ti < t.length) { if (q[qi] === t[ti]) qi++; ti++; } return qi / q.length;
    };
    const levenshtein = (a, b) => { if (a === b) return 0; if (!a) return b.length; if (!b) return a.length; const dp = Array(b.length + 1).fill(0); for (let j = 0; j <= b.length; j++) dp[j] = j; for (let i = 1; i <= a.length; i++) { let prev = dp[0]; dp[0] = i; for (let j = 1; j <= b.length; j++) { const tmp = dp[j]; dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1); prev = tmp; } } return dp[b.length]; };
    const fuzzyMatch = (query, text) => {
        if (!query) return true;
        const qn = normalize(query);
        const tn = normalize(text);
        if (tn.includes(qn)) return true;
        const seq = charSeqScore(qn, tn);
        if (seq >= 0.85) return true;
        if (qn.length >= 4) {
            const dist = levenshtein(qn, tn.substring(0, Math.min(tn.length, qn.length + 2)));
            if (dist <= 2) return true;
        }
        return false;
    };
    let baseList;
    if (tab === 'unassigned') baseList = unassigned; else if (execViewExec) baseList = assignedByExec[execViewExec.id] || []; else baseList = [];
    const filteredCompanies = baseList.filter(c => fuzzyMatch(companySearch, `${c.name || ''} ${c.code}`));

    const toggleSelect = (code) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
        });
    };

    const clearSelection = () => setSelected(new Set());

    // When switching tab or leaving exec view, clear state
    useEffect(() => { clearSelection(); setCompanySearch(''); if (tab === 'unassigned') setExecViewExec(null); }, [tab]);

    const beginAssignOrReassign = () => {
        if (selected.size === 0) return; setAssignModalVisible(true);
    };

    const performAssign = async (execId) => {
        setMutating(true);
        try {
            const h = await StorageService.getAuthHeader();
            const body = { company_codes: Array.from(selected), executive_id: execId };
            const r = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/assignments/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
            if (!r.ok) {
                if (r.status === 404) {
                    // fallback sequential assignment
                    for (const code of body.company_codes) {
                        try {
                            await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/executives/${execId}/assign/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h } });
                        } catch (_) { }
                    }
                } else { throw new Error('assign'); }
            }
            await fetchCompanies();
            setAssignModalVisible(false);
            clearSelection();
        } catch (e) { console.error(e); Alert.alert('Assign Failed', 'Could not assign'); }
        finally { setMutating(false); }
    };

    const performUnassign = async () => {
        if (selected.size === 0) return;
        Alert.alert('Unassign', `Remove ${selected.size} company assignment(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unassign', style: 'destructive', onPress: async () => {
                    setMutating(true);
                    try {
                        const h = await StorageService.getAuthHeader();
                        const body = { company_codes: Array.from(selected) };
                        const r = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/assignments/unassign`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
                        if (!r.ok) {
                            if (r.status === 404) {
                                // fallback sequential unassign; need to know current executive for each; fallback tries all execs endpoint
                                // We rely on existing assignments in companies state (assigned_executive_id)
                                for (const code of body.company_codes) {
                                    const c = companies.find(x => x.code === code);
                                    if (c && c.assigned_executive_id) {
                                        try { await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/executives/${c.assigned_executive_id}/assign/${code}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...h } }); } catch (_) { }
                                    }
                                }
                            } else { throw new Error('unassign'); }
                        }
                        await fetchCompanies();
                        clearSelection();
                    } catch (e) { console.error(e); Alert.alert('Unassign Failed', 'Could not unassign'); }
                    finally { setMutating(false); }
                }
            }
        ]);
    };

    const toggleSelectAllFiltered = () => {
        setSelected(prev => {
            const next = new Set(prev);
            const allCodes = filteredCompanies.map(c => c.code);
            const allSelected = allCodes.every(c => next.has(c));
            if (allSelected) { allCodes.forEach(c => next.delete(c)); } else { allCodes.forEach(c => next.add(c)); }
            return next;
        });
    };

    const renderCompanyItem = ({ item }) => {
        const sel = selected.has(item.code);
        return (
            <TouchableOpacity onPress={() => toggleSelect(item.code)} activeOpacity={0.75}>
                <Card style={[styles.companyCard, sel && styles.companyCardSelected]} padded={false}>
                    <View style={styles.row}>
                        <View style={styles.avatar}><Ionicons name={sel ? 'checkbox' : 'checkbox-outline'} size={18} color={sel ? tokens.colors.accent : tokens.colors.textDim} /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.companyName}>{item.name || item.code}</Text>
                            <Text style={styles.meta}>{item.code}</Text>
                        </View>
                        {item.assigned_executive_id ? (
                            item.assigned_executive_active === false ? (
                                <Text style={[styles.execTag, styles.inactiveTag]}>Exec {item.assigned_executive_id} (inactive)</Text>
                            ) : item.assigned_executive_username ? (
                                <Text style={styles.execTag}>{item.assigned_executive_username}</Text>
                            ) : (
                                <Text style={[styles.execTag, styles.inactiveTag]}>Exec {item.assigned_executive_id}</Text>
                            )
                        ) : (
                            <Text style={[styles.execTag, styles.unassignedTag]}>Unassigned</Text>
                        )}
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <Screen title="Company Assignments" subtitle="Assign / manage executive ownership">
            {!loading && companies.length > 0 && (
                <Text style={styles.debugSummary}>Total: {companies.length} | Unassigned: {unassigned.length} | Assigned: {assigned.length}</Text>
            )}
            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity style={[styles.tabBtn, tab === 'unassigned' && styles.tabBtnActive]} onPress={() => setTab('unassigned')}>
                    <Text style={[styles.tabText, tab === 'unassigned' && styles.tabTextActive]}>Unassigned ({unassigned.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, { marginRight: 0 }, tab === 'assigned' && styles.tabBtnActive]} onPress={() => setTab('assigned')}>
                    <Text style={[styles.tabText, tab === 'assigned' && styles.tabTextActive]}>Assigned ({assigned.length})</Text>
                </TouchableOpacity>
            </View>
            {tab === 'assigned' && !execViewExec && (
                <View style={styles.execListContainer}>
                    <FlatList
                        data={execSummaries}
                        keyExtractor={i => i.id.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity activeOpacity={0.75} onPress={() => { setExecViewExec(item); setCompanySearch(''); clearSelection(); }}>
                                <Card style={styles.execCard}>
                                    <View style={styles.row}>
                                        <View style={[styles.avatar, { backgroundColor: '#111' }]}><Ionicons name={item.is_active ? 'person' : 'person-outline'} size={18} color={item.is_active ? tokens.colors.accent : tokens.colors.textDim} /></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.companyName}>{item.username}</Text>
                                            <Text style={styles.meta}>{item.is_active ? 'Active' : 'Inactive'}</Text>
                                        </View>
                                        <Text style={styles.countTag}>{item.count}</Text>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                        ListEmptyComponent={<Card><Text style={{ color: tokens.colors.textDim }}>No assigned executives.</Text></Card>}
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={{ paddingBottom: 160 }}
                    />
                </View>
            )}
            {tab === 'assigned' && execViewExec && (
                <View style={styles.execHeaderRow}>
                    <TouchableOpacity onPress={() => { setExecViewExec(null); }} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={16} color={tokens.colors.text} />
                        <Text style={styles.backBtnText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.execHeaderTitle}>{execViewExec.username}</Text>
                    <View style={{ width: 60 }} />
                </View>
            )}
            {/* Search + Select All (only when we have a company list visible) */}
            {(tab === 'unassigned' || (tab === 'assigned' && execViewExec)) && (
                <View style={styles.searchRowLarge}>
                    <Ionicons name="search" size={18} color={tokens.colors.textDim} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search companies (fuzzy)"
                        placeholderTextColor={tokens.colors.textDim}
                        style={styles.searchInputLarge}
                        value={companySearch}
                        onChangeText={setCompanySearch}
                    />
                    <TouchableOpacity onPress={toggleSelectAllFiltered} style={styles.selectAllLargeBtn}>
                        <Text style={styles.selectAllLargeText}>Select All</Text>
                    </TouchableOpacity>
                </View>
            )}
            {/* Companies list area */}
            {loading ? (
                <View style={{ paddingVertical: 50 }}><ActivityIndicator color={tokens.colors.accent} /></View>
            ) : ((tab === 'unassigned') || (tab === 'assigned' && execViewExec) ? (
                <FlatList
                    data={filteredCompanies}
                    keyExtractor={i => i.code}
                    renderItem={renderCompanyItem}
                    ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
                    contentContainerStyle={{ paddingBottom: 160 }}
                    onRefresh={fetchCompanies}
                    refreshing={loading}
                    ListEmptyComponent={<Card><Text style={{ color: tokens.colors.textDim }}>No companies.</Text></Card>}
                    showsVerticalScrollIndicator={false}
                />
            ) : null)}
            {selected.size > 0 && ((tab === 'unassigned') || (tab === 'assigned' && execViewExec)) && (
                <View style={styles.actionBar}>
                    <Text style={styles.actionBarText}>{selected.size} selected</Text>
                    {tab === 'unassigned' ? (
                        <TouchableOpacity disabled={mutating} onPress={beginAssignOrReassign} style={[styles.actionBtn, styles.assignBtn]}>
                            {mutating ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>Assign</Text>}
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity disabled={mutating} onPress={performUnassign} style={[styles.actionBtn, styles.unassignBtn]}>
                                {mutating ? <ActivityIndicator color="#fff" /> : <Text style={styles.unassignBtnText}>Unassign</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity disabled={mutating} onPress={beginAssignOrReassign} style={[styles.actionBtn, styles.assignBtn]}>
                                {mutating ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>Reassign</Text>}
                            </TouchableOpacity>
                        </>
                    )}
                    <TouchableOpacity onPress={clearSelection} style={[styles.actionBtn, styles.clearBtn]}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            )}
            <Modal transparent visible={assignModalVisible} animationType="fade" onRequestClose={() => setAssignModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Select Executive</Text>
                        {executiveLoading ? <ActivityIndicator color={tokens.colors.accent} /> : (
                            <FlatList
                                data={executives.filter(e => e.is_active)}
                                keyExtractor={i => i.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity disabled={mutating} style={styles.execRow} onPress={() => performAssign(item.id)}>
                                        <Text style={styles.execRowText}>{item.username}</Text>
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                                ListEmptyComponent={<Text style={{ color: tokens.colors.textDim, marginTop: 12 }}>No active executives.</Text>}
                            />
                        )}
                        <TouchableOpacity onPress={() => setAssignModalVisible(false)} style={styles.closeModalBtn}><Text style={styles.closeModalText}>Close</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    companyCard: { paddingHorizontal: 16, paddingVertical: 14 },
    companyCardSelected: { borderWidth: 1, borderColor: tokens.colors.accent, backgroundColor: 'rgba(200,241,76,0.05)' },
    row: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: tokens.colors.border },
    companyName: { color: tokens.colors.text, fontWeight: '600', fontSize: 15 },
    meta: { color: tokens.colors.textDim, fontSize: 11, marginTop: 2 },
    execTag: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#111', borderRadius: 10, color: tokens.colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    unassignedTag: { backgroundColor: '#181818', color: tokens.colors.warning },
    inactiveTag: { backgroundColor: '#181818', color: tokens.colors.textDim },
    searchRowLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 14 },
    searchInputLarge: { flex: 1, color: tokens.colors.text, fontSize: 15, fontWeight: '500', paddingVertical: 6 },
    selectAllLargeBtn: { marginLeft: 10, backgroundColor: tokens.colors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
    selectAllLargeText: { color: '#000', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#101010', borderTopWidth: 1, borderColor: '#222', padding: 14, flexDirection: 'row', alignItems: 'center' },
    actionBarText: { color: tokens.colors.text, fontWeight: '600', flex: 1 },
    actionBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, marginLeft: 8 },
    assignBtn: { backgroundColor: tokens.colors.accent },
    actionBtnText: { color: '#000', fontWeight: '600' },
    unassignBtn: { backgroundColor: tokens.colors.danger },
    unassignBtnText: { color: '#fff', fontWeight: '600' },
    clearBtn: { backgroundColor: '#222' },
    clearBtnText: { color: tokens.colors.textDim, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: tokens.colors.card, borderRadius: 20, padding: 20, width: '100%', maxHeight: '80%', borderWidth: 1, borderColor: tokens.colors.border },
    modalTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
    execRow: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border },
    execRowText: { color: tokens.colors.text },
    closeModalBtn: { marginTop: 14, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#222', borderRadius: 10 },
    closeModalText: { color: tokens.colors.textDim, fontWeight: '500' },
    infoBanner: { color: tokens.colors.warning, fontSize: 11, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
    debugSummary: { color: tokens.colors.textDim, fontSize: 11, textAlign: 'center', marginBottom: 8 },
    execCard: { paddingHorizontal: 16, paddingVertical: 16 },
    countTag: { backgroundColor: tokens.colors.accent, color: '#000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: '600' },
    execHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border },
    backBtnText: { marginLeft: 6, color: tokens.colors.text, fontSize: 12, fontWeight: '600' },
    execHeaderTitle: { flex: 1, textAlign: 'center', color: tokens.colors.text, fontWeight: '600', fontSize: 16 },
    execListContainer: { flex: 1, marginBottom: 16 },
    tabRow: { flexDirection: 'row', marginBottom: 12, gap: 12 },
    tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#111', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
    tabBtnActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
    tabText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '500' },
    tabTextActive: { color: '#000', fontWeight: '600' },
});
