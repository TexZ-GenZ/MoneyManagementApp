import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

export default function CompanyListScreen() {
  const [companies, setCompanies] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { loadCompanies(); }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/companies`, { method: 'GET', headers: { 'content-type': 'application/json' } });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const dataArr = data.items || [];
      setCompanies(dataArr);
      setFiltered(dataArr);
    } catch (e) {
      setCompanies([]); setFiltered([]);
    } finally { setLoading(false); }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) { setFiltered(companies); return; }
    const lower = text.toLowerCase();
    setFiltered(companies.filter(c => (c.name && c.name.toLowerCase().includes(lower)) || (c.code && c.code.toLowerCase().includes(lower))));
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.cardTouchable}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '../(others)/BiilsScreen', params: { name: item.name, code: item.code, amount: item.amount, outbal: item.outbal } })}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.code}>{item.code}</Text>
        </View>
        <Text style={styles.area}>{item.area}</Text>
        <View style={styles.rowLine} />
        <View style={styles.metaRow}>
          <Text style={styles.meta}><Text style={styles.metaLabel}>Credit</Text> {item.credit_date || '—'}</Text>
          <Text style={styles.meta}><Text style={styles.metaLabel}>Promise</Text> {item.promise_date || '—'}</Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.outbal}>Outbal: <Text style={styles.outbalValue}>{item.outbal}</Text></Text>
          <Text style={styles.amount}>Amt: <Text style={styles.amountValue}>{item.amount}</Text></Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen title="Companies" subtitle="Browse all companies">
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or code"
          value={search}
          onChangeText={handleSearch}
          placeholderTextColor={tokens.colors.textFaint}
        />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={tokens.colors.accent} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>No companies found.</Text>}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        />
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
  card: { paddingVertical: 18, paddingHorizontal: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '600', color: tokens.colors.text, flex: 1, paddingRight: 8 },
  code: { fontSize: 13, color: tokens.colors.textDim, fontWeight: '500' },
  area: { fontSize: 12, color: tokens.colors.textDim, marginBottom: 8 },
  rowLine: { height: 1, backgroundColor: tokens.colors.divider, marginBottom: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  meta: { fontSize: 12, color: tokens.colors.textDim },
  metaLabel: { color: tokens.colors.text, fontWeight: '600' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between' },
  outbal: { fontSize: 12, color: tokens.colors.textDim },
  outbalValue: { color: tokens.colors.danger, fontWeight: '700' },
  amount: { fontSize: 12, color: tokens.colors.textDim },
  amountValue: { color: tokens.colors.accent, fontWeight: '700' },
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 15, padding: 24 },
});
