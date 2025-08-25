import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { formatDate } from '../../src/ui/format';
import { tokens } from '../../src/ui/tokens';
import { StorageService } from '../../src/services/storageService';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../../src/utils/constants';

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('overdue'); // overdue | upcoming

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await StorageService.getToken();
      const base = API_BASE_URL;
      // Primary endpoint for exec
      let resp = await fetch(`${base}/me/companies`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` } });
      let data = await resp.json();
      if (!resp.ok) {
        // fallback: fetch /auth/me to get id then /executives/{id}/companies
        const meResp = await fetch(`${base}/auth/me`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` } });
        const meData = await meResp.json();
        if (meResp.ok && meData?.id) {
          resp = await fetch(`${base}/executives/${meData.id}/companies`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` } });
          data = await resp.json();
        }
      }
      if (!resp.ok) throw new Error(data?.detail || 'Load failed');
      const items = Array.isArray(data.items) ? data.items : data;
      setCompanies(items || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setCompanies([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Interval refresh every 60s
  useEffect(() => { const id = setInterval(fetchData, 60000); return () => clearInterval(id); }, [fetchData]);
  // Refresh on focus
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const today = useMemo(() => new Date(), []);
  const parseDate = (d) => { try { return d ? new Date(d) : null; } catch { return null; } };
  const money = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '—';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const classify = useCallback((c) => {
    // Earliest actionable date from API (next_due_date); today counts as overdue
    const due = parseDate(c.next_due_date);
    if (!due) return { bucket: 'none', due };
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    const dueMid = new Date(due); dueMid.setHours(0, 0, 0, 0);
    const diffDays = (dueMid - todayMid) / 86400000;
    if (diffDays <= 0) return { bucket: 'overdue', due: dueMid };
    if (diffDays > 0 && diffDays <= 7) return { bucket: 'upcoming', due: dueMid };
    return { bucket: 'later', due: dueMid };
  }, []);

  const enriched = useMemo(() => companies.map(c => ({ ...c, __cls: classify(c) })), [companies, classify]);
  // Sort by oldest due first within buckets
  const overdueCompanies = useMemo(() => enriched
    .filter(c => c.__cls.bucket === 'overdue')
    .sort((a, b) => (a.__cls.due - b.__cls.due))
  , [enriched]);
  const upcomingCompanies = useMemo(() => enriched
    .filter(c => c.__cls.bucket === 'upcoming')
    .sort((a, b) => (a.__cls.due - b.__cls.due))
  , [enriched]);

  const activeList = viewMode === 'upcoming' ? upcomingCompanies : overdueCompanies;
  const previewList = activeList.slice(0, 8);

  const nextActionableCount = overdueCompanies.length;

  const formatShortDate = (d) => d ? formatDate(d) : '—';
  const badgeFor = (it) => {
    const bucket = it.__cls?.bucket;
    if (bucket === 'overdue') return <Text style={[styles.badge, styles.badgeOverdue]}>OVERDUE</Text>;
    if (bucket === 'upcoming') return <Text style={[styles.badge, styles.badgeUpcoming]}>{formatShortDate(it.__cls.due)}</Text>;
    return null;
  };
  const renderItem = ({ item }) => {
    const pending = typeof item.pending_count === 'number' ? item.pending_count : 0;
    const overdue = typeof item.overdue_count === 'number' ? item.overdue_count : 0;
    return (
      <Card style={styles.companyCard}>
        <TouchableOpacity style={styles.companyTouchable} onPress={() => router.push({ pathname: '../(others)/BiilsScreen', params: { name: item.name, code: item.code, outbal: item.outbal } })} activeOpacity={0.8}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.companyName} numberOfLines={1}>{item.name || '—'}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            <Text style={styles.companyMeta} numberOfLines={2}>
              {item.code} • Oldest Due <Text style={styles.metaStrong}>{formatShortDate(item.__cls?.due)}</Text>
            </Text>
            <Text style={styles.companyMetaSecondary} numberOfLines={1}>
              <Text style={styles.overdueLabel}>Overdue</Text> <Text style={[styles.metaStrong, styles.overdueCount]}>{overdue}</Text> • <Text style={styles.tapHint}>Tap to open</Text>
            </Text>
          </View>
          {badgeFor(item)}
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <Screen title="Dashboard" subtitle="Collections Priority" scroll hideBackButton hideTopBar>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Assigned</Text>
            <Text style={styles.summaryValue}>{companies.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Overdue</Text>
            <Text style={[styles.summaryValue, { color: tokens.colors.danger }]}>{overdueCompanies.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Upcoming 7d</Text>
            <Text style={[styles.summaryValue, { color: tokens.colors.accent }]}>{upcomingCompanies.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Pending Bills</Text>
            <Text style={[styles.summaryValue, { color: tokens.colors.warning || '#f5b100' }]}>{enriched.reduce((s, c) => s + (c.pending_count || 0), 0)}</Text>
          </View>
        </View>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={[styles.quickBtn, viewMode === 'overdue' && styles.quickBtnActive]} onPress={() => setViewMode('overdue')}>
            <Text style={[styles.quickBtnText, viewMode === 'overdue' && styles.quickBtnTextActive]}>Overdue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, viewMode === 'upcoming' && styles.quickBtnActive]} onPress={() => setViewMode('upcoming')}>
            <Text style={[styles.quickBtnText, viewMode === 'upcoming' && styles.quickBtnTextActive]}>Upcoming</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.primaryCTA} onPress={() => router.push('../CompanyList/ExecutiveCompanies')}>
          <Text style={styles.primaryCTAText}>View All Companies</Text>
        </TouchableOpacity>
        <Text style={styles.nextHint}>{nextActionableCount === 0 ? 'No overdue companies. Great!' : `${nextActionableCount} companies overdue.`}</Text>
      </Card>
      <View style={{ height: 24 }} />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {viewMode === 'overdue' && `Overdue (Top ${previewList.length})`}
          {viewMode === 'upcoming' && `Upcoming 7 Days (Top ${previewList.length})`}
        </Text>
        {!loading && activeList.length > 8 && (
          <TouchableOpacity onPress={() => router.push('../CompanyList/ExecutiveCompanies')}><Text style={styles.viewAll}>See All</Text></TouchableOpacity>
        )}
      </View>
      <Card style={styles.listCard}>
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={tokens.colors.accent} /></View>
        ) : error ? (
          <View style={styles.loadingWrap}><Text style={styles.errorText}>{error}</Text></View>
        ) : previewList.length === 0 ? (
          <Text style={styles.empty}>{viewMode === 'overdue' ? 'No overdue companies. Good job.' : 'No upcoming promises in next 7 days.'}</Text>
        ) : (
          <FlatList data={previewList} keyExtractor={(item, i) => item.code + i} renderItem={renderItem} scrollEnabled={false} />
        )}
      </Card>
      <View style = {{marginBottom : 30}} ></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {},
  summaryRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryBox: { width: '48%', backgroundColor: tokens.colors.cardAlt, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: tokens.colors.textDim, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 22, fontWeight: '700', color: tokens.colors.accent },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  // Updated to themed cardAlt color (was hardcoded #111)
  quickBtn: { flex: 1, marginHorizontal: 4, backgroundColor: tokens.colors.cardAlt, paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border },
  quickBtnActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  quickBtnText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  quickBtnTextActive: { color: '#000', fontWeight: '800' },
  primaryCTA: { marginTop: 10, backgroundColor: tokens.colors.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  primaryCTAText: { color: '#000', fontSize: 14, fontWeight: '800' },
  nextHint: { marginTop: 10, fontSize: 11, color: tokens.colors.textDim, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: tokens.colors.text },
  viewAll: { fontSize: 11, fontWeight: '600', color: tokens.colors.accent },
  listCard: { paddingHorizontal: 0, paddingVertical: 0 },
  loadingWrap: { paddingVertical: 32 },
  companyCard: { marginHorizontal: 12, marginVertical: 10, paddingHorizontal: 0, paddingVertical: 0 },
  companyTouchable: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 0, borderColor: tokens.colors.border },
  companyName: { color: tokens.colors.text, fontSize: 18, fontWeight: '800' },
  companyMeta: { color: tokens.colors.textSubtle, fontSize: 14, lineHeight: 20 },
  companyMetaSecondary: { color: tokens.colors.textFaint, fontSize: 12, marginTop: 6 },
  outbalValue: { color: tokens.colors.danger, fontWeight: '700' },
  metaStrong: { color: tokens.colors.text, fontWeight: '700' },
  chevron: { marginLeft: 6, color: tokens.colors.textDim, fontSize: 18, fontWeight: '300' },
  badge: { fontSize: 12, fontWeight: '800', color: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, letterSpacing: 0.6 },
  tapHint: { color: tokens.colors.accent, fontWeight: '800' },
  overdueLabel: { color: tokens.colors.danger, fontWeight: '800' },
  overdueCount: { color: tokens.colors.danger, fontWeight: '800' },
  badgeOverdue: { backgroundColor: tokens.colors.danger },
  badgeUpcoming: { backgroundColor: tokens.colors.accent, color: '#000' },
  empty: { color: tokens.colors.textDim, fontSize: 12, padding: 16, textAlign: 'center' },
  errorText: { color: tokens.colors.danger, fontSize: 12, textAlign: 'center' },
});
