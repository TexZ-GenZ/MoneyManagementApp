import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

// Demo fetch -- replace with real API call
// const fetchCompanies = async()=>{
//   const res = await 
//   console.log(res.json())
//   return res.json()
// } 
export default function ExecutiveCompaniesScreen() {
  const router = useRouter();
  const { execId, execUsername } = useLocalSearchParams();

  // Raw data
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | zero
  const [sortMode, setSortMode] = useState('overdue_desc'); // overdue_desc | pending_desc | outbal_desc | outbal_asc | oldest_due_asc
  const [showFilters, setShowFilters] = useState(false); // default collapsed per request
  // Removed oldest-due bucket filters; use sort chip "Oldest Due" instead

  const fetchAuthHeader = async () => {
    const header = await StorageService.getAuthHeader();
    return header || null;
  };

  const loadCompanies = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const header = await fetchAuthHeader();
      let url;
      if (execId) {
        // Explicit exec id passed (e.g., from an executive list) use that endpoint
        url = `${process.env.EXPO_PUBLIC_APP_URI}/executives/${execId}/companies`;
      } else {
        // Fallback: current logged-in executive's own companies
        url = `${process.env.EXPO_PUBLIC_APP_URI}/me/companies`;
      }
      const response = await fetch(url, { method: 'GET', headers: header });
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      // API may return { items: [...] } or a bare list
      const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
      // Directly set companies (no pending bills enrichment to avoid heavy extra requests)
      setCompanies(items);
    } catch (e) {
      setError(e.message || 'Error');
      setCompanies([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [execId]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  // Date fields (credit/promise) removed per request.
  const money = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '—';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    let list = companies.filter(c => {
      if (!lower) return true;
      return (
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.code && c.code.toLowerCase().includes(lower))
      );
    }).filter(c => {
      const outbalNum = parseFloat(c.outbal);
      switch (filter) {
        case 'zero': return !outbalNum;
        case 'active': return outbalNum > 0;
        default: return true;
      }
    });
    // Sorting
    const safeNum = (v) => {
      const n = parseFloat(v); return isNaN(n) ? 0 : n;
    };
    list.sort((a, b) => {
      switch (sortMode) {
        case 'pending_desc':
          return (b.pending_count || 0) - (a.pending_count || 0);
        case 'overdue_desc':
          return (b.overdue_count || 0) - (a.overdue_count || 0);
        case 'oldest_due_asc': {
          const parseYMDToUTC = (val) => {
            if (!val || typeof val !== 'string') return null;
            const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (!m) return null;
            const y = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const d = parseInt(m[3], 10);
            const ms = Date.UTC(y, mo, d);
            return isNaN(ms) ? null : ms;
          };
          const aMs = parseYMDToUTC(a?.next_due_date) ?? parseYMDToUTC(a?.oldest_due_date);
          const bMs = parseYMDToUTC(b?.next_due_date) ?? parseYMDToUTC(b?.oldest_due_date);
          if (aMs === null && bMs === null) {
            const an = (a?.name || a?.code || '').toString();
            const bn = (b?.name || b?.code || '').toString();
            return an.localeCompare(bn);
          }
          if (aMs === null) return 1; // nulls last
          if (bMs === null) return -1;
          if (aMs !== bMs) return aMs - bMs;
          const an = (a?.name || a?.code || '').toString();
          const bn = (b?.name || b?.code || '').toString();
          return an.localeCompare(bn);
        }
        case 'outbal_asc':
          return safeNum(a.outbal) - safeNum(b.outbal);
        case 'outbal_desc':
        default:
          return safeNum(b.outbal) - safeNum(a.outbal);
      }
    });
    return list;
  }, [companies, search, filter, sortMode]);

  // Removed aggregate totals per user request

  const onRefresh = () => loadCompanies(true);

  // Pending bills display removed to avoid per-company heavy requests

  const renderItem = ({ item }) => {
    const outbalNum = Number(item.outbal) || 0;
    const amountNum = Number(item.amount) || 0;
    const execName = item.executive || item.executive_name || item.assigned_executive_username || item.assigned_executive_name || item.area || execUsername;
    return (
      <TouchableOpacity
        style={styles.cardTouchable}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '../(others)/BiilsScreen', params: { name: item.name, code: item.code, amount: item.amount, outbal: item.outbal } })}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
              <View style={styles.subRow}>
                <Text style={styles.code}>{item.code}</Text>
                {execName ? <View style={styles.areaBadge}><Text style={styles.areaBadgeText}>{execName}</Text></View> : null}
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.amountRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>OUTBAL</Text>
              <Text style={[styles.metricValue, outbalNum > 0 ? styles.dangerValue : null]} numberOfLines={1}>{outbalNum}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>AMOUNT</Text>
              <Text style={styles.metricValue} numberOfLines={1}>{amountNum}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>OVERDUE</Text>
              <Text style={[styles.metricValue, (item.overdue_count || 0) > 0 ? styles.dangerValue : null]} numberOfLines={1}>{item.overdue_count ?? 0}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>PENDING</Text>
              <Text style={styles.metricValue} numberOfLines={1}>{item.pending_count ?? 0}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const FilterChip = ({ value, label }) => (
    <TouchableOpacity onPress={() => setFilter(value)} activeOpacity={0.7} style={[styles.chip, filter === value && styles.chipActive]}>
      <Text style={[styles.chipText, filter === value && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const sortChips = [
    { value: 'overdue_desc', label: 'Overdue High' },
    { value: 'pending_desc', label: 'Pending High' },
    { value: 'outbal_desc', label: 'Outbal High' },
    { value: 'outbal_asc', label: 'Outbal Low' },
    { value: 'oldest_due_asc', label: 'Oldest Due' },
  ];

  const SortChip = ({ value, label }) => (
    <TouchableOpacity onPress={() => setSortMode(value)} activeOpacity={0.7} style={[styles.sortChip, sortMode === value && styles.sortChipActive]}>
      <Text style={[styles.sortChipText, sortMode === value && styles.sortChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  // Header moved inline into ListHeaderComponent to avoid remounts and keep TextInput focus stable

  return (
    <Screen title={execUsername ? execUsername : 'Executive'} subtitle="Assigned Companies">
      {loading ? (
        <ActivityIndicator size="large" color={tokens.colors.accent} style={{ marginTop: 40 }} />
      ) : error ? (
        <Card style={styles.errorCard}><Text style={styles.errorText}>Failed to load companies. Pull to retry.</Text></Card>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListHeaderComponent={(
            <View>
              <View style={styles.searchWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search companies"
                  value={search}
                  onChangeText={setSearch}
                  placeholderTextColor={tokens.colors.textFaint}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  blurOnSubmit={false}
                />
              </View>
              <View style={styles.toolbar}>
                <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowFilters(s => !s)}>
                  <Text style={styles.toolbarBtnText}>{showFilters ? 'Hide Filters' : 'Filters & Sort'}</Text>
                </TouchableOpacity>
                <Text style={styles.toolbarSummary} numberOfLines={1}>
                  {`${filtered.length} shown · Sort: ${sortMode.replace('_', ' ')}`}
                </Text>
              </View>
              {showFilters && (
                <Card style={styles.filtersContainer}>
                  <Text style={styles.filtersHeading}>Filter</Text>
                  <View style={styles.filterWrap}>
                    <FilterChip value="all" label="All" />
                    <FilterChip value="active" label=">0 Outbal" />
                    <FilterChip value="zero" label="Zero" />
                  </View>
                  {/* Oldest Due bucket filters removed; use Sort -> Oldest Due */}
                  <View style={styles.dividerLine} />
                  <Text style={styles.filtersHeading}>Sort</Text>
                  <View style={styles.sortWrap}>{sortChips.map(s => <SortChip key={s.value} value={s.value} label={s.label} />)}</View>
                </Card>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No companies match.</Text>}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrapper: { marginBottom: 12 },
  searchInput: {
    backgroundColor: tokens.colors.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  filtersContainer: { padding: 14, marginBottom: 16 },
  filtersHeading: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  sortWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dividerLine: { height: 1, backgroundColor: tokens.colors.divider, marginVertical: 12 },
  // Toolbar for collapsible filters (match AllCompanies)
  toolbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  toolbarBtn: { backgroundColor: 'rgba(255,255,255,0.10)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  toolbarBtnText: { color: tokens.colors.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  toolbarSummary: { flex: 1, color: tokens.colors.textSubtle, fontSize: 11, fontWeight: '500' },
  chip: { backgroundColor: tokens.colors.cardAlt, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: tokens.colors.border },
  chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  chipText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  // Dedicated styles for sort chips (were removed inadvertently)
  sortChip: { backgroundColor: tokens.colors.cardAlt, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: tokens.colors.border },
  sortChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  sortChipText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '600' },
  sortChipTextActive: { color: '#000' },
  // Card visuals aligned with AllCompanies
  cardTouchable: { marginBottom: 16 },
  card: { paddingVertical: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)' },
  cardHeader: { flexDirection: 'row', marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginBottom: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 12, color: tokens.colors.textDim, fontWeight: '600' },
  areaBadge: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  areaBadgeText: { fontSize: 10, fontWeight: '600', color: tokens.colors.textSubtle, letterSpacing: 0.5 },
  chevron: { fontSize: 30, lineHeight: 30, color: tokens.colors.textDim, fontWeight: '300' },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  metricBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  metricLabel: { fontSize: 10, fontWeight: '600', color: tokens.colors.textSubtle, marginBottom: 4, letterSpacing: 0.5 },
  metricValue: { fontSize: 14, fontWeight: '700', color: tokens.colors.accent },
  dangerValue: { color: tokens.colors.danger },
  // pending bills styles removed
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 14, padding: 24 },
  errorCard: { padding: 16, marginTop: 24 },
  errorText: { color: tokens.colors.danger, fontSize: 14, textAlign: 'center' }
});
