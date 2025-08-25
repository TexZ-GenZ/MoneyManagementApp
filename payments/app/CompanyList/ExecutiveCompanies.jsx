import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [sortMode, setSortMode] = useState('overdue_desc'); // overdue_desc | pending_desc | outbal_desc | outbal_asc

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
    // Backend does not return an executive name on company objects; assignment is separate.
    // User clarified that 'area' is effectively the executive identifier, so we display it as Executive.
    const executiveName = item.area || execUsername || '-';
    return (
      <TouchableOpacity
        style={styles.cardTouchable}
        activeOpacity={0.82}
        onPress={() => router.push({ pathname: '../(others)/BiilsScreen', params: { name: item.name, code: item.code, outbal: item.outbal } })}
      >
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.textDim} style={styles.arrowIcon} />
          </View>
          <View style={styles.metaRowTop}>
            <Text style={styles.metaLabel}>Executive:</Text>
            <Text style={styles.metaValue}>{executiveName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Code:</Text>
            <Text style={styles.metaValue}>{item.code}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Outstanding:</Text>
            <Text style={styles.outbalValue}>{money(item.outbal)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Overdue:</Text>
            <Text style={[styles.metaValue, (item.overdue_count || 0) > 0 ? { color: tokens.colors.danger } : null]}>{item.overdue_count ?? 0}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Pending:</Text>
            <Text style={styles.metaValue}>{item.pending_count ?? 0}</Text>
          </View>
          <View style={styles.tapHintRow}>
            <Ionicons name="document-text-outline" size={14} color={tokens.colors.accent} />
            <Text style={styles.tapHint}>View bills</Text>
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
              <Card style={styles.filtersContainer}>
                <Text style={styles.filtersHeading}>Filter</Text>
                <View style={styles.filterWrap}>
                  <FilterChip value="all" label="All" />
                  <FilterChip value="active" label=">0 Outbal" />
                  <FilterChip value="zero" label="Zero" />
                </View>
                <View style={styles.dividerLine} />
                <Text style={styles.filtersHeading}>Sort</Text>
                <View style={styles.sortWrap}>{sortChips.map(s => <SortChip key={s.value} value={s.value} label={s.label} />)}</View>
              </Card>
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  filtersContainer: { padding: 14, marginBottom: 16 },
  filtersHeading: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  sortWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dividerLine: { height: 1, backgroundColor: tokens.colors.divider, marginVertical: 12 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  chipText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  chipTextActive: { color: '#000' },
  sortChip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  sortChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  sortChipText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  sortChipTextActive: { color: '#000' },
  cardTouchable: { marginBottom: 20 },
  card: { paddingVertical: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  name: { fontSize: 18, fontWeight: '700', color: tokens.colors.text, flex: 1, paddingRight: 12, letterSpacing: 0.3 },
  arrowIcon: { marginLeft: 6 },
  metaRowTop: { flexDirection: 'row', marginBottom: 4 },
  metaRow: { flexDirection: 'row', marginBottom: 4 },
  metaLabel: { width: 90, fontSize: 12, fontWeight: '600', color: tokens.colors.textSubtle },
  metaValue: { flex: 1, fontSize: 13, fontWeight: '600', color: tokens.colors.text },
  outbalValue: { fontSize: 13, fontWeight: '700', color: tokens.colors.danger },
  tapHintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  tapHint: { fontSize: 11, fontWeight: '600', color: tokens.colors.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  // pending bills styles removed
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 14, padding: 24 },
  errorCard: { padding: 16, marginTop: 24 },
  errorText: { color: tokens.colors.danger, fontSize: 14, textAlign: 'center' }
});
