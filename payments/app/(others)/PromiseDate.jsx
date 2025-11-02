import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { formatDate, formatCurrency } from '../../src/ui/format';

// Mock data - will be replaced with API call later
const MOCK_DATA = {
  '1d': [
    {
      bill_number: 'INV-2025-001',
      company_name: 'Tech Solutions Ltd',
      company_code: 'TECH001',
      executive_name: 'Rajesh Kumar',
      promise_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 125000,
      bill_id: 101
    },
    {
      bill_number: 'INV-2025-045',
      company_name: 'Global Enterprises',
      company_code: 'GLB045',
      executive_name: 'Priya Sharma',
      promise_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 87500,
      bill_id: 102
    }
  ],
  '3d': [
    {
      bill_number: 'INV-2025-023',
      company_name: 'Alpha Industries',
      company_code: 'ALP023',
      executive_name: 'Amit Patel',
      promise_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 215000,
      bill_id: 103
    },
    {
      bill_number: 'INV-2025-067',
      company_name: 'Sunrise Corp',
      company_code: 'SUN067',
      executive_name: 'Rajesh Kumar',
      promise_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 156000,
      bill_id: 104
    }
  ],
  '5d': [
    {
      bill_number: 'INV-2025-089',
      company_name: 'Metro Traders',
      company_code: 'MET089',
      executive_name: 'Sneha Gupta',
      promise_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 98000,
      bill_id: 105
    }
  ],
  '1w': [
    {
      bill_number: 'INV-2025-112',
      company_name: 'Vertex Solutions',
      company_code: 'VER112',
      executive_name: 'Vikram Singh',
      promise_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 340000,
      bill_id: 106
    },
    {
      bill_number: 'INV-2025-134',
      company_name: 'Phoenix Enterprises',
      company_code: 'PHX134',
      executive_name: 'Priya Sharma',
      promise_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 189000,
      bill_id: 107
    }
  ],
  '2w': [
    {
      bill_number: 'INV-2025-156',
      company_name: 'Stellar Industries',
      company_code: 'STL156',
      executive_name: 'Amit Patel',
      promise_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      outstanding_amount: 267000,
      bill_id: 108
    }
  ]
};

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

  const handleItemPress = (item) => {
    router.push({
      pathname: '../(others)/PaymentDetail',
      params: {
        bill_id: item.bill_id,
        bill_number: item.bill_number,
        code: item.company_code,
        name: item.company_name,
        outbal: item.outstanding_amount,
        promise_date: item.promise_date
      }
    });
  };

  const renderPaymentItem = (item, periodKey) => {
    const daysUntil = Math.ceil((new Date(item.promise_date) - new Date()) / (1000 * 60 * 60 * 24));
    
    return (
      <TouchableOpacity
        key={`${periodKey}-${item.bill_number}`}
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
            <Text style={styles.companyName}>{item.company_name}</Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.amount}>{formatCurrency(item.outstanding_amount)}</Text>
            <View style={styles.daysTag}>
              <Text style={styles.daysText}>{daysUntil}d</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.itemFooter}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={tokens.colors.textDim} />
            <Text style={styles.metaText}>{item.executive_name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={tokens.colors.textDim} />
            <Text style={styles.metaText}>{formatDate(item.promise_date)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (periodKey, periodLabel) => {
    const items = MOCK_DATA[periodKey] || [];
    if (items.length === 0) return null;
    if (selectedFilter !== 'all' && selectedFilter !== periodKey) return null;

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

  // Calculate total items for selected filter
  const getTotalCount = () => {
    if (selectedFilter === 'all') {
      return Object.values(MOCK_DATA).reduce((sum, items) => sum + items.length, 0);
    }
    return MOCK_DATA[selectedFilter]?.length || 0;
  };

  return (
    <Screen
      title="Upcoming Collections"
      scroll
      backButton
    >
      {/* Filter Buttons */}
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
              All ({getTotalCount()})
            </Text>
          </TouchableOpacity>
          
          {TIME_PERIODS.map((period) => {
            const count = MOCK_DATA[period.key]?.length || 0;
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
            <Text style={styles.summaryValue}>{getTotalCount()}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="cash-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Expected Amount</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(
                Object.values(MOCK_DATA)
                  .flat()
                  .filter(item => selectedFilter === 'all' || MOCK_DATA[selectedFilter]?.includes(item))
                  .reduce((sum, item) => sum + item.outstanding_amount, 0)
              )}
            </Text>
          </View>
        </View>
      </Card>

      {/* Sections */}
      <View style={styles.sectionsContainer}>
        {TIME_PERIODS.map((period) => renderSection(period.key, period.label))}
      </View>

      {getTotalCount() === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={48} color={tokens.colors.textDim} />
          <Text style={styles.emptyText}>No upcoming collections</Text>
        </Card>
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
