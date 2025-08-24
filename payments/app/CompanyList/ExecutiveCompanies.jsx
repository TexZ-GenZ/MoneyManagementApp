import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
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
  const [filter, setFilter] = useState('all'); // all | overdue | zero | active
  // Removed sorting state per updated UX (simpler filter-only view)

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
      setCompanies(items);
    } catch (e) {
      setError(e.message || 'Error');
      setCompanies([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [execId]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const today = useMemo(() => new Date(), []);
  const parseDate = (d) => { try { return d ? new Date(d) : null; } catch { return null; } };
  const isPast = (d) => d && d < new Date(today.toDateString());
  const formatDate = (d) => {
    const dt = parseDate(d); if (!dt) return '—';
    return dt.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  };
  const money = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '—';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const list = companies.filter(c => {
      if (!lower) return true;
      return (
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.code && c.code.toLowerCase().includes(lower))
      );
    }).filter(c => {
      const credit = parseDate(c.credit_date);
      const promise = parseDate(c.promise_date);
      const overdue = isPast(credit) || isPast(promise);
      const outbalNum = parseFloat(c.outbal);
      switch (filter) {
        case 'overdue': return overdue;
        case 'zero': return !outbalNum;
        case 'active': return outbalNum > 0;
        default: return true;
      }
    });
    // Default ordering: highest outbal first for prioritization
    return list.sort((a, b) => (parseFloat(b.outbal) || 0) - (parseFloat(a.outbal) || 0));
  }, [companies, search, filter]);

  // Removed aggregate totals per user request

  const onRefresh = () => loadCompanies(true);

  const renderTag = (label, type) => (
    <View style={[styles.statusTag, type === 'overdue' && styles.tagOverdue]}>
      <Text style={styles.statusTagText}>{label}</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const creditPast = isPast(parseDate(item.credit_date));
    const promisePast = isPast(parseDate(item.promise_date));
    const overdue = creditPast || promisePast;
    return (
      <TouchableOpacity
        style={styles.cardTouchable}
        activeOpacity={0.75}
        onPress={() => router.push({ pathname: '../(others)/BiilsScreen', params: { name: item.name, code: item.code, outbal: item.outbal } })}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
            <Text style={styles.code}>{item.code}</Text>
          </View>
          {(item.area || item.location) && (
            <Text style={styles.area}>{item.area || item.location}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Credit </Text>{formatDate(item.credit_date)}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Promise </Text>{formatDate(item.promise_date)}</Text>
          </View>
          <View style={styles.singleOutbalRow}>
            <Text style={styles.outbal}>Outstanding Balance: <Text style={styles.outbalValue}>{money(item.outbal)}</Text></Text>
          </View>
          <View style={styles.tagsRow}>
            {overdue ? renderTag('Overdue', 'overdue') : renderTag('Clear', 'ok')}
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

  // Removed sort chips per request

  return (
    <Screen title={execUsername ? execUsername : 'Executive'} subtitle="Assigned Companies">
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
        />
      </View>
      <View style={styles.filterWrap}>
        <FilterChip value="all" label="All" />
        <FilterChip value="overdue" label="Overdue" />
        <FilterChip value="active" label=">0 Outbal" />
        <FilterChip value="zero" label="Zero" />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={tokens.colors.accent} style={{ marginTop: 32 }} />
      ) : error ? (
        <Card style={styles.errorCard}><Text style={styles.errorText}>Failed to load companies. Pull to retry.</Text></Card>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>No companies match.</Text>}
          contentContainerStyle={{ paddingBottom: 60 }}
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
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  chipText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  chipTextActive: { color: '#000' },
  sortChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  sortChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  sortChipText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  sortChipTextActive: { color: '#000' },
  cardTouchable: { marginBottom: 14 },
  card: { paddingVertical: 16, paddingHorizontal: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '600', color: tokens.colors.text, flex: 1, paddingRight: 8 },
  code: { fontSize: 13, color: tokens.colors.textDim, fontWeight: '500' },
  area: { fontSize: 11, color: tokens.colors.textDim, marginBottom: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  meta: { fontSize: 12, color: tokens.colors.textDim },
  metaLabel: { color: tokens.colors.text, fontWeight: '600' },
  singleOutbalRow: { marginTop: 2 },
  outbal: { fontSize: 12, color: tokens.colors.textDim },
  outbalValue: { color: tokens.colors.danger, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  statusTag: { backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 14 },
  tagOverdue: { backgroundColor: tokens.colors.danger },
  statusTagText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.6 },
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 14, padding: 24 },
  errorCard: { padding: 16, marginTop: 24 },
  errorText: { color: tokens.colors.danger, fontSize: 14, textAlign: 'center' }
});
