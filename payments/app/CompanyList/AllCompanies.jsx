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
  const [sortMode, setSortMode] = useState('OUTBAL_DESC'); // default now outbal desc
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  useEffect(() => { loadCompanies(); }, []);

  // Refetch when server-side capable filters/sorts change (excluding search which has its own flow)
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
    else params.set('sort', 'name_asc');
    if (search.trim().length >= 2) params.set('q', search.trim());
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

  useEffect(() => {
    // Remote filter when search text length >=2
    const t = search.trim();
    if (t.length >= 2) {
      remoteSearch(t);
    } else {
      // fallback to local filtering of initial batch
      handleSearch(t);
    }
  }, [search]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      // Initial fetch honors default sort (outbal desc)
      const response = await fetch(`${API_BASE_URL}/companies?skip=0&limit=1000&sort=outbal_desc`, { method: 'GET', headers: { 'content-type': 'application/json' } });
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
    if (!text.trim()) { setFiltered(companies); }
  };

  // Use the preserved full executive list so options don't disappear when filters are applied
  const executives = useMemo(() => allExecutives, [allExecutives]);

  // finalData now just filtered for local quick search (<2 chars) since server handled main filters
  const finalData = filtered;

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
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const Option = ({ label, active, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.option, active && styles.optionActive]} activeOpacity={0.7}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const toggleExec = (name) => {
    setExecFilters(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  const clearExec = () => setExecFilters([]);

  return (
    <Screen title="Companies" subtitle="Browse all companies">
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or code"
          value={search}
          onChangeText={handleSearch}
          placeholderTextColor={tokens.colors.textFaint}
          autoCorrect={false}
          autoCapitalize='none'
          returnKeyType='search'
        />
      </View>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowFilters(s => !s)}>
          <Text style={styles.toolbarBtnText}>Filters & Sort</Text>
        </TouchableOpacity>
        <Text style={styles.toolbarSummary} numberOfLines={1}>
          {`${filtered.length} shown · Sort: ${sortMode.toLowerCase()}${execFilters.length ? ' · Execs: ' + execFilters.length : ''}`}
        </Text>
      </View>
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.panelHeading}>Sort By</Text>
          <View style={styles.optionsRow}>
            <Option label="Outbal High→Low" active={sortMode === 'OUTBAL_DESC'} onPress={() => setSortMode('OUTBAL_DESC')} />
            <Option label="Outbal Low→High" active={sortMode === 'OUTBAL_ASC'} onPress={() => setSortMode('OUTBAL_ASC')} />
            <Option label="Amount High→Low" active={sortMode === 'AMOUNT_DESC'} onPress={() => setSortMode('AMOUNT_DESC')} />
            <Option label="Amount Low→High" active={sortMode === 'AMOUNT_ASC'} onPress={() => setSortMode('AMOUNT_ASC')} />
          </View>
          <View style={styles.optionsRow}>
            <Option label="Name" active={sortMode === 'NAME_ASC'} onPress={() => setSortMode('NAME_ASC')} />
            <Option label="Code" active={sortMode === 'CODE_ASC'} onPress={() => setSortMode('CODE_ASC')} />
          </View>
          <Text style={styles.panelHeading}>Executives ({execFilters.length ? execFilters.length : 'all'})</Text>
          <View style={styles.execContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {executives.map(e => {
                const active = execFilters.includes(e);
                return (
                  <TouchableOpacity key={e} onPress={() => toggleExec(e)} style={[styles.execPill, active && styles.execPillActive]} activeOpacity={0.7}>
                    <Text style={[styles.execPillText, active && styles.execPillTextActive]}>{e}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {execFilters.length > 0 && (
              <TouchableOpacity onPress={clearExec} style={styles.clearExecBelow} activeOpacity={0.7}>
                <Text style={styles.clearExecBelowText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.closePanelBtn} onPress={() => setShowFilters(false)}>
            <Text style={styles.closePanelText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="large" color={tokens.colors.accent} style={{ marginTop: 30 }} />
      ) : (
        <>
          <FlatList
            data={finalData}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.empty}>No companies match filters.</Text>}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrapper: { marginBottom: 16 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
  toolbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  toolbarBtn: { backgroundColor: 'rgba(255,255,255,0.10)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  toolbarBtnText: { color: tokens.colors.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  toolbarSummary: { flex: 1, color: tokens.colors.textSubtle, fontSize: 11, fontWeight: '500' },
  filterPanel: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 12 },
  panelHeading: { fontSize: 11, fontWeight: '700', color: tokens.colors.textDim, marginTop: 4, marginBottom: 6, letterSpacing: 0.5 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  option: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  optionActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  optionText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textDim },
  optionTextActive: { color: '#000' },
  execContainer: { marginTop: 4, marginBottom: 8 },
  execPill: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  execPillActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  execPillText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textDim },
  execPillTextActive: { color: '#000' },
  // clearExec styles removed; "Clear" now appears as a trailing pill
  clearExecBelow: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  clearExecBelowText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textSubtle },
  closePanelBtn: { marginTop: 4, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.10)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  closePanelText: { color: tokens.colors.textSubtle, fontSize: 12, fontWeight: '600' },
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 15, padding: 24 },
});
