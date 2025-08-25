import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { API_BASE_URL } from '../../src/utils/constants';

export default function CompanyListScreen() {
  const [companies, setCompanies] = useState([]);
  // baseFiltered = result of search (remote or local); further filters (area, balance, sort) applied client-side
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  // Keep the full list of executives from the initial unfiltered load so multi-select options don't disappear.
  const [allExecutives, setAllExecutives] = useState([]);
  // Executive filter (unique executive names). Fallback to 'area' field if executive name not provided by API.
  const [execFilters, setExecFilters] = useState([]); // multi usernames
  const [sortMode, setSortMode] = useState('OVERDUE_DESC'); // default: overdue high first
  // Filters are collapsible; default collapsed (prior behavior)
  const [showFilters, setShowFilters] = useState(false);
  // Removed oldest-due bucket filters; use sort chip "Oldest Due" instead
  const router = useRouter();

  useEffect(() => { loadCompanies(); }, []);

  // Refetch when server-side capable filters/sorts change (excluding search which is now handled in handleSearch)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('skip', '0');
    params.set('limit', '1000');
    execFilters.forEach(u => params.append('exec_usernames', u));
    if (sortMode === 'CODE_ASC') params.set('sort', 'code_asc');
    else if (sortMode === 'OUTBAL_DESC') params.set('sort', 'outbal_desc');
    else if (sortMode === 'OUTBAL_ASC') params.set('sort', 'outbal_asc');
    else if (sortMode === 'AMOUNT_DESC') params.set('sort', 'amount_desc');
    else if (sortMode === 'AMOUNT_ASC') params.set('sort', 'amount_asc');
    else if (sortMode === 'PENDING_DESC') params.set('sort', 'pending_desc');
    else if (sortMode === 'OVERDUE_DESC') params.set('sort', 'overdue_desc');
    // For OLDEST_DUE_ASC, we sort client-side; keep server sort neutral
    else if (sortMode === 'OLDEST_DUE_ASC') params.set('sort', 'name_asc');
    else params.set('sort', 'name_asc');
    // Don't include search in this effect - it's handled in handleSearch
    const url = `${API_BASE_URL}/companies?${params.toString()}`;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(url, { headers: { 'content-type': 'application/json' } });
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) {
            setCompanies(data.items || []);
            setFiltered(data.items || []); // base for local quick search <2 chars
            // Don't overwrite allExecutives here; keep the full universe from initial load
          }
        }
      } catch (_e) { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [execFilters, sortMode]);

  // Remove the problematic useEffect that triggers on every search change

  const loadCompanies = async () => {
    setLoading(true);
    try {
      // Initial fetch honors default sort (outbal desc)
      const response = await fetch(`${API_BASE_URL}/companies?skip=0&limit=1000&sort=overdue_desc`, { method: 'GET', headers: { 'content-type': 'application/json' } });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const dataArr = data.items || [];
      setCompanies(dataArr);
      setFiltered(dataArr);
      // Capture the full executive list from the initial unfiltered dataset
      const uniq = new Set();
      dataArr.forEach(c => {
        const execName = c.executive || c.executive_name || c.assigned_executive_username || c.assigned_executive_name || c.area;
        if (execName) uniq.add(execName);
      });
      setAllExecutives(Array.from(uniq).sort((a, b) => (a || '').localeCompare(b || '')));
    } catch (e) {
      setCompanies([]); setFiltered([]);
    } finally { setLoading(false); }
  };

  const remoteSearch = async (text) => {
    try {
      const q = encodeURIComponent(text);
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('skip', '0');
      params.set('limit', '1000');
      execFilters.forEach(u => params.append('exec_usernames', u));
      // Maintain current sort when searching
      if (sortMode === 'CODE_ASC') params.set('sort', 'code_asc');
      else if (sortMode === 'OUTBAL_DESC') params.set('sort', 'outbal_desc');
      else if (sortMode === 'OUTBAL_ASC') params.set('sort', 'outbal_asc');
      else if (sortMode === 'AMOUNT_DESC') params.set('sort', 'amount_desc');
      else if (sortMode === 'AMOUNT_ASC') params.set('sort', 'amount_asc');
      else if (sortMode === 'PENDING_DESC') params.set('sort', 'pending_desc');
      else if (sortMode === 'OVERDUE_DESC') params.set('sort', 'overdue_desc');
      // Client-side sort for oldest due
      else if (sortMode === 'OLDEST_DUE_ASC') params.set('sort', 'name_asc');
      else params.set('sort', 'name_asc');
      const response = await fetch(`${API_BASE_URL}/companies?${params.toString()}`, { method: 'GET', headers: { 'content-type': 'application/json' } });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      const items = data.items || [];
      setFiltered(items);
    } catch (e) {
      // fallback to local
      const lower = text.toLowerCase();
      setFiltered(companies.filter(c => (c.name && c.name.toLowerCase().includes(lower)) || (c.code && c.code.toLowerCase().includes(lower))));
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    const t = text.trim();
    if (t.length >= 2) {
      // Remote search for longer queries
      remoteSearch(t);
    } else {
      // Local filtering for short queries
      if (!t) {
        setFiltered(companies);
      } else {
        const lower = t.toLowerCase();
        setFiltered(companies.filter(c =>
          (c.name && c.name.toLowerCase().includes(lower)) ||
          (c.code && c.code.toLowerCase().includes(lower))
        ));
      }
    }
  };

  // Use the preserved full executive list so options don't disappear when filters are applied
  const executives = useMemo(() => allExecutives, [allExecutives]);

  // finalData now filtered additionally by oldest due bucket
  const finalData = useMemo(() => {
    const base = filtered || [];
    // Apply client-side sort for oldest due if selected
    if (sortMode === 'OLDEST_DUE_ASC') {
      const arr = base.slice();
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
      arr.sort((a, b) => {
        // Prefer effective earliest due (next_due_date) if present; fallback to raw oldest_due_date
        const aMs = parseYMDToUTC(a?.next_due_date) ?? parseYMDToUTC(a?.oldest_due_date);
        const bMs = parseYMDToUTC(b?.next_due_date) ?? parseYMDToUTC(b?.oldest_due_date);
        // push nulls to bottom
        if (aMs === null && bMs === null) {
          // stable-ish tie-breaker to avoid jitter
          const an = (a?.name || a?.code || '').toString();
          const bn = (b?.name || b?.code || '').toString();
          return an.localeCompare(bn);
        }
        if (aMs === null) return 1;
        if (bMs === null) return -1;
        if (aMs !== bMs) return aMs - bMs;
        // same date -> tie-break by name/code
        const an = (a?.name || a?.code || '').toString();
        const bn = (b?.name || b?.code || '').toString();
        return an.localeCompare(bn);
      });
      return arr;
    }
    return base;
  }, [filtered, sortMode]);

  const renderItem = ({ item }) => {
    const outbalNum = Number(item.outbal) || 0;
    const amountNum = Number(item.amount) || 0;
    // ratio removed (was outbal/amount) to reduce confusion; could be re-added as OUTBAL % if needed
    const execName = item.executive || item.executive_name || item.assigned_executive_username || item.assigned_executive_name || item.area;
    return (
      <TouchableOpacity
        style={styles.cardTouchable}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '../(others)/BiilsScreen', params: { name: item.name, code: item.code, amount: item.amount, outbal: item.outbal } })}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
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

  const toggleExec = (name) => {
    setExecFilters(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  const clearExec = () => setExecFilters([]);

  // Chip components (shared look with ExecutiveCompanies)
  const Chip = ({ active, label, onPress }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const sortChips = [
    { value: 'OVERDUE_DESC', label: 'Overdue High' },
    { value: 'PENDING_DESC', label: 'Pending High' },
    { value: 'OUTBAL_DESC', label: 'Outbal High' },
    { value: 'OUTBAL_ASC', label: 'Outbal Low' },
    { value: 'AMOUNT_DESC', label: 'Amount High' },
    { value: 'AMOUNT_ASC', label: 'Amount Low' },
    { value: 'OLDEST_DUE_ASC', label: 'Oldest Due' },
    { value: 'NAME_ASC', label: 'Name' },
    { value: 'CODE_ASC', label: 'Code' },
  ];

  return (
    <Screen title="Companies" subtitle="Browse all companies">
      {loading ? (
        <ActivityIndicator size="large" color={tokens.colors.accent} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={finalData}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListHeaderComponent={(
            <>
              <View style={styles.searchWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search companies"
                  value={search}
                  onChangeText={handleSearch}
                  placeholderTextColor={tokens.colors.textFaint}
                  autoCorrect={false}
                  autoCapitalize='none'
                  returnKeyType='search'
                  blurOnSubmit={false}
                />
              </View>
              <View style={styles.toolbar}>
                <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowFilters(s => !s)}>
                  <Text style={styles.toolbarBtnText}>{showFilters ? 'Hide Filters' : 'Filters & Sort'}</Text>
                </TouchableOpacity>
                <Text style={styles.toolbarSummary} numberOfLines={1}>
                  {`${finalData.length} shown · Sort: ${sortMode.toLowerCase()}${execFilters.length ? ' · Execs: ' + execFilters.length : ''}`}
                </Text>
              </View>
              {showFilters && (
                <Card style={styles.filtersContainer}>
                  <Text style={styles.filtersHeading}>Sort</Text>
                  <View style={styles.sortWrap}>
                    {sortChips.map(s => (
                      <Chip key={s.value} label={s.label} active={sortMode === s.value} onPress={() => setSortMode(s.value)} />
                    ))}
                  </View>
                  {/* Oldest Due bucket filters removed; use Sort -> Oldest Due */}
                  <View style={styles.dividerLine} />
                  <Text style={styles.filtersHeading}>Executives {execFilters.length ? `(${execFilters.length})` : '(all)'}</Text>
                  <View style={styles.filterWrap}>
                    {executives.map(e => (
                      <Chip key={e} label={e} active={execFilters.includes(e)} onPress={() => toggleExec(e)} />
                    ))}
                    {executives.length > 0 && execFilters.length > 0 && (
                      <Chip label={'Clear'} active={false} onPress={clearExec} />
                    )}
                  </View>
                </Card>
              )}
            </>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No companies match filters.</Text>}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
  // ratio styles removed after metric simplification
  // Toolbar for collapsible filters
  toolbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  toolbarBtn: { backgroundColor: 'rgba(255,255,255,0.10)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  toolbarBtnText: { color: tokens.colors.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  toolbarSummary: { flex: 1, color: tokens.colors.textSubtle, fontSize: 11, fontWeight: '500' },
  // Shared filter UI with ExecutiveCompanies
  filtersContainer: { padding: 14, marginBottom: 16 },
  filtersHeading: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  sortWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dividerLine: { height: 1, backgroundColor: tokens.colors.divider, marginVertical: 12 },
  chip: { backgroundColor: tokens.colors.cardAlt, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: tokens.colors.border },
  chipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  chipText: { color: tokens.colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 15, padding: 24 },
});