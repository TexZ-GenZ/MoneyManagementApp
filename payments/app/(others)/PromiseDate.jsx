import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { formatDate, formatCurrency } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';
import { API_BASE_URL } from '../../src/utils/constants';

const TIME_PERIODS = [
  { key: '1d', label: '1 Day' },
  { key: '3d', label: '3 Days' },
  { key: '5d', label: '5 Days' },
  { key: '1w', label: '1 Week' },
  { key: '2w', label: '2 Weeks' }
];

export default function PromiseDate() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [buckets, setBuckets] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const firstFocus = useRef(true);

  const fetchBuckets = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await StorageService.getToken();
      const resp = await fetch(`${API_BASE_URL}/admin/promises/upcoming`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token.access_token}` } : {}),
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Request failed');
      }
      const data = await resp.json();
      setBuckets(data?.buckets || {});
      setGeneratedAt(data?.generated_at || null);
    } catch (err) {
      console.error('failed to load upcoming promises', err);
      setError('Could not load upcoming promise buckets.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => { fetchBuckets(false); }, [fetchBuckets]);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    fetchBuckets(true);
  }, [fetchBuckets]));

  const bucketData = useMemo(() => buckets || {}, [buckets]);
  const activeKeys = useMemo(() => (
    selectedFilter === 'all' ? TIME_PERIODS.map(p => p.key) : [selectedFilter]
  ), [selectedFilter]);

  const totalCount = useMemo(() => (
    activeKeys.reduce((sum, key) => sum + ((bucketData[key] || []).length), 0)
  ), [activeKeys, bucketData]);

  const totalAmount = useMemo(() => (
    activeKeys.reduce((sum, key) => (
      sum + (bucketData[key] || []).reduce((inner, item) => inner + Number(item.outstanding_amount || 0), 0)
    ), 0)
  ), [activeKeys, bucketData]);

  const lastUpdatedLabel = useMemo(() => {
    if (!generatedAt) return 'Updated just now';
    try {
      const dt = new Date(generatedAt);
      if (Number.isNaN(dt.getTime())) return 'Updated just now';
      return `Updated ${dt.toLocaleString()}`;
    } catch {
      return 'Updated just now';
    }
  }, [generatedAt]);

  const handleItemPress = (item) => {
    router.push({
      pathname: '../(others)/PaymentDetail',
      params: {
        bill_id: item.bill_id,
        bill_number: item.bill_number,
        code: item.company_code,
        name: item.company_name,
        outbal: item.outstanding_amount,
        promise_date: item.promise_date,
      },
    });
  };

  const renderPaymentItem = (item, periodKey) => {
    const promiseDate = item.promise_date ? new Date(item.promise_date) : null;
    const daysUntil = promiseDate ? Math.max(0, Math.ceil((promiseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

    return (
      <TouchableOpacity
        key={`${periodKey}-${item.bill_id}`}
        style={styles.paymentItem}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemLeft}>
            <View style={styles.billNumberRow}>
              <Ionicons name="document-text-outline" size={16} color={tokens.colors.accent} />
              <Text style={styles.billNumber}>{item.bill_number}</Text>
            </View>
            <Text style={styles.companyName}>{item.company_name || item.company_code}</Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.amount}>{formatCurrency(Number(item.outstanding_amount || 0))}</Text>
            <View style={styles.daysTag}>
              <Text style={styles.daysText}>{daysUntil}d</Text>
            </View>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={tokens.colors.textDim} />
            <Text style={styles.metaText}>{item.executive_name || '—'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={tokens.colors.textDim} />
            <Text style={styles.metaText}>{item.promise_date ? formatDate(item.promise_date) : '—'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (periodKey, periodLabel) => {
    if (selectedFilter !== 'all' && selectedFilter !== periodKey) return null;
    const items = bucketData[periodKey] || [];
    if (items.length === 0) return null;

    return (
      <View key={periodKey} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{periodLabel}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>
        <Card style={styles.sectionCard}>
          {items.map((item) => renderPaymentItem(item, periodKey))}
        </Card>
      </View>
    );
  };

  return (
    <Screen
      title="Upcoming Collections"
      scroll
      backButton
    >
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterBtn, selectedFilter === 'all' && styles.filterBtnActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterBtnText, selectedFilter === 'all' && styles.filterBtnTextActive]}>
              All ({totalCount})
            </Text>
          </TouchableOpacity>
          
          {TIME_PERIODS.map((period) => {
            const count = (bucketData[period.key] || []).length;
            return (
              <TouchableOpacity
                key={period.key}
                style={[styles.filterBtn, selectedFilter === period.key && styles.filterBtnActive]}
                onPress={() => setSelectedFilter(period.key)}
              >
                <Text style={[styles.filterBtnText, selectedFilter === period.key && styles.filterBtnTextActive]}>
                  {period.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="time-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Total Upcoming</Text>
            <Text style={styles.summaryValue}>{totalCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="cash-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Expected Amount</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.timestamp}>{lastUpdatedLabel}</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchBuckets(true)} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.refreshBtnText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={tokens.colors.accent} size="large" />
        </Card>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="warning-outline" size={32} color={tokens.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBuckets(false)}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <>
          <View style={styles.sectionsContainer}>
            {TIME_PERIODS.map((period) => renderSection(period.key, period.label))}
          </View>
          {totalCount === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={48} color={tokens.colors.textDim} />
              <Text style={styles.emptyText}>No upcoming collections</Text>
            </Card>
          )}
        </>
      )}

      <View style={{ marginBottom: 30 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    marginBottom: 16,
  },
  filterScroll: {
    paddingHorizontal: 4,
    gap: 8,
  },
  filterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: tokens.colors.cardAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginRight: 8,
  },
  filterBtnActive: {
    backgroundColor: tokens.colors.accent,
    borderColor: tokens.colors.accent,
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  filterBtnTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  summaryCard: {
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 60,
    backgroundColor: tokens.colors.border,
    marginHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: tokens.colors.textDim,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  sectionsContainer: {
    gap: 20,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  paymentItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  loadingCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    backgroundColor: tokens.colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  refreshBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  timestamp: {
    fontSize: 11,
    color: tokens.colors.textDim,
  },
  errorCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: tokens.colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  billNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  billNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
    marginLeft: 22,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.accent,
    marginBottom: 6,
  },
  daysTag: {
    backgroundColor: tokens.colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  daysText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: tokens.colors.textDim,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: tokens.colors.textDim,
    marginTop: 12,
  },
});
