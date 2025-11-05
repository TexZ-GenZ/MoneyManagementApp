import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { formatCurrency, formatDate } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';
import { API_BASE_URL } from '../../src/utils/constants';

const PERIOD_LABELS = {
  all: 'All',
  '1d': '1 Day',
  '3d': '3 Days',
  '5d': '5 Days',
  '1w': '1 Week',
  '2w': '2 Weeks',
  date: 'Specific Date',
};

const getDaysUntil = (promiseDate) => {
  if (!promiseDate) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(promiseDate);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const matchesFilter = (bill, filterType, filterValue) => {
  const promiseDate = bill.promise_date ? new Date(bill.promise_date) : null;
  if (!promiseDate) return false;
  promiseDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (promiseDate.getTime() < today.getTime()) return false;

  const daysUntil = getDaysUntil(bill.promise_date);

  if (filterType === 'date' && filterValue) {
    const selected = new Date(filterValue);
    selected.setHours(0, 0, 0, 0);
    return promiseDate.getTime() === selected.getTime();
  }

  // "All" shows promises up to 3 months (90 days)
  if (filterValue === 'all') {
    return daysUntil >= 0 && daysUntil <= 90;
  }

  switch (filterValue) {
    case '1d':
      return daysUntil === 1;
    case '3d':
      return daysUntil === 3;
    case '5d':
      return daysUntil === 5;
    case '1w':
      return daysUntil === 7;
    case '2w':
      return daysUntil === 14;
    case 'all':
    default:
      return daysUntil >= 0 && daysUntil <= 90;
  }
};

export default function PromiseCompaniesScreen() {
  const router = useRouter();
  const { execId, execUsername, filterType, filterValue } = useLocalSearchParams();

  const [bills, setBills] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const header = await StorageService.getAuthHeader();
      
      const billsResponse = await fetch(`${API_BASE_URL}/admin/promises/upcoming?limit_per_bucket=200`, {
        headers: header,
      });

      if (!billsResponse.ok) {
        const text = await billsResponse.text();
        throw new Error(text || 'Failed to load upcoming promises');
      }

      const payload = await billsResponse.json();
      const buckets = payload?.buckets || {};
      const flattened = [];
      Object.keys(buckets).forEach((bucketKey) => {
        const bucketBills = buckets[bucketKey] || [];
        bucketBills.forEach((bill) => {
          flattened.push({ ...bill, bucket_key: bucketKey });
        });
      });
      setBills(flattened);
    } catch (err) {
      console.error('Failed to load upcoming promises', err);
      setError('Could not load promise data. Pull to refresh.');
      setBills([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const filteredBills = useMemo(() => {
    const targetExecId = execId ? String(execId) : 'unassigned';
    return bills.filter((bill) => {
      const billExecId = bill.executive_id != null ? String(bill.executive_id) : 'unassigned';
      if (billExecId !== targetExecId) return false;
      return matchesFilter(bill, filterType, filterValue || 'all');
    });
  }, [bills, execId, filterType, filterValue]);

  const companyGroups = useMemo(() => {
    const byCompany = new Map();

    filteredBills.forEach((bill) => {
      const code = bill.company_code;
      if (!code) return;

      const outstanding = Number(bill.outstanding_amount || bill.amount || 0);
      if (!byCompany.has(code)) {
        byCompany.set(code, {
          code,
          name: bill.company_name || code,
          earliestPromise: bill.promise_date || null,
          totalOutstanding: 0,
          promiseCount: 0,
        });
      }

      const entry = byCompany.get(code);
      entry.totalOutstanding += outstanding;
      entry.promiseCount += 1;
      if (bill.promise_date && (!entry.earliestPromise || new Date(bill.promise_date) < new Date(entry.earliestPromise))) {
        entry.earliestPromise = bill.promise_date;
      }
    });

    return Array.from(byCompany.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [filteredBills]);

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (companyGroups.length === 0) {
        setCompanies([]);
        return;
      }

      try {
        const header = await StorageService.getAuthHeader();
        const companyPromises = companyGroups.map(async (group) => {
          try {
            const response = await fetch(`${API_BASE_URL}/companies/${group.code}`, {
              headers: header,
            });
            if (response.ok) {
              const companyData = await response.json();
              return {
                ...group,
                outbal: companyData.outbal || group.totalOutstanding,
                area: companyData.area,
              };
            }
          } catch (err) {
            console.error(`Failed to fetch company ${group.code}`, err);
          }
          return group;
        });

        const companiesWithOutbal = await Promise.all(companyPromises);
        setCompanies(companiesWithOutbal);
      } catch (err) {
        console.error('Failed to fetch company details', err);
        setCompanies(companyGroups);
      }
    };

    fetchCompanyDetails();
  }, [companyGroups]);

  const totalOutstanding = useMemo(() => {
    return companies.reduce((sum, company) => sum + Number(company.outbal || company.totalOutstanding || 0), 0);
  }, [companies]);

  const totalPromises = filteredBills.length;

  const onRefresh = useCallback(() => fetchData(true), [fetchData]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.cardTouchable}
      activeOpacity={0.7}
      onPress={() => router.push({
        pathname: '../(others)/BiilsScreen',
        params: {
          name: item.name,
          code: item.code,
          outbal: String(item.outbal || item.totalOutstanding),
        },
      })}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrapper}>
            <Ionicons name="business" size={20} color={tokens.colors.accent} />
          </View>
          <View style={styles.cardTitle}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.subRow}>
              <Text style={styles.code}>{item.code}</Text>
              {item.area && <Text style={styles.area}>• {item.area}</Text>}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={tokens.colors.textDim} />
        </View>
        
        <View style={styles.badgeRow}>
          <View style={styles.promiseBadge}>
            <Ionicons name="calendar-outline" size={12} color="#000" />
            <Text style={styles.promiseBadgeText}>{item.promiseCount} promise{item.promiseCount !== 1 ? 's' : ''}</Text>
          </View>
          {item.earliestPromise && (
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>Next: {formatDate(item.earliestPromise)}</Text>
            </View>
          )}
        </View>

        <View style={styles.amountRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>OUTSTANDING</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {formatCurrency(item.outbal || item.totalOutstanding)}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const periodLabel = filterType === 'date'
    ? (filterValue ? formatDate(filterValue) : 'Selected Date')
    : PERIOD_LABELS[filterValue] || 'All';

  return (
    <Screen
      title={execUsername || 'Executive'}
      subtitle={`${periodLabel} • ${companies.length} companies`}
      backButton
    >
      {loading ? (
        <ActivityIndicator size="large" color={tokens.colors.accent} style={styles.spinner} />
      ) : error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="warning-outline" size={32} color={tokens.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListHeaderComponent={(
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Ionicons name="business-outline" size={20} color={tokens.colors.accent} />
                  <Text style={styles.summaryLabel}>Companies</Text>
                  <Text style={styles.summaryValue}>{companies.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="documents-outline" size={20} color={tokens.colors.accent} />
                  <Text style={styles.summaryLabel}>Total Promises</Text>
                  <Text style={styles.summaryValue}>{totalPromises}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="cash-outline" size={20} color={tokens.colors.accent} />
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={(
            <Card style={styles.emptyCard}>
              <Ionicons name="business-outline" size={48} color={tokens.colors.textDim} />
              <Text style={styles.empty}>No companies with promises for this selection.</Text>
            </Card>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { marginTop: 40 },
  summaryCard: { padding: 18, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: tokens.colors.textDim, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginTop: 2 },
  summaryDivider: { width: 1, height: 48, backgroundColor: tokens.colors.border, marginHorizontal: 10 },
  listContent: { paddingBottom: 80 },
  cardTouchable: { marginBottom: 16 },
  card: { 
    paddingVertical: 16, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderColor: tokens.colors.border, 
    borderRadius: 16 
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.cardAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { flex: 1, paddingRight: 10 },
  name: { fontSize: 16, fontWeight: '700', color: tokens.colors.text, marginBottom: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: { fontSize: 12, color: tokens.colors.textDim, fontWeight: '600' },
  area: { fontSize: 11, color: tokens.colors.textSubtle, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  promiseBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.accent, 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 12 
  },
  promiseBadgeText: { fontSize: 11, fontWeight: '700', color: '#000', letterSpacing: 0.3 },
  dateBadge: {
    backgroundColor: tokens.colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  dateBadgeText: { fontSize: 10, fontWeight: '600', color: tokens.colors.textDim },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  metricBox: { 
    flex: 1, 
    backgroundColor: tokens.colors.cardAlt, 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: tokens.colors.border 
  },
  metricLabel: { fontSize: 10, fontWeight: '600', color: tokens.colors.textSubtle, marginBottom: 4, letterSpacing: 0.5 },
  metricValue: { fontSize: 16, fontWeight: '700', color: tokens.colors.danger },
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { color: tokens.colors.textDim, textAlign: 'center', fontSize: 14, marginTop: 12 },
  errorCard: { padding: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: tokens.colors.danger, fontSize: 14, textAlign: 'center' },
});
