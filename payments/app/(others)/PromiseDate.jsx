import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { formatDate, formatCurrency } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';
import { API_BASE_URL } from '../../src/utils/constants';

const TIME_PERIODS = [
  { key: '1d', label: '1 Day', days: 1 },
  { key: '3d', label: '3 Days', days: 3 },
  { key: '5d', label: '5 Days', days: 5 },
  { key: '1w', label: '1 Week', days: 7 },
  { key: '2w', label: '2 Weeks', days: 14 }
];

export default function PromiseDate() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null); // For calendar selection
  const [showCalendar, setShowCalendar] = useState(false);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const firstFocus = useRef(true);

  // Calculate date range for calendar (today to 2 years from now)
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];
  const maxDate = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  const fetchBills = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const header = await StorageService.getAuthHeader();
      const resp = await fetch(`${API_BASE_URL}/admin/promises/upcoming?limit_per_bucket=200`, {
        headers: header,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Request failed');
      }
      const data = await resp.json();
  const buckets = data?.buckets || {};
      const flattened = [];
      Object.keys(buckets).forEach((bucketKey) => {
        const items = buckets[bucketKey] || [];
        items.forEach((item) => {
          flattened.push({ ...item, bucket_key: bucketKey });
        });
      });
      setBills(flattened);
    } catch (err) {
      console.error('failed to load bills', err);
      setError('Could not load promise data.');
      setBills([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => { fetchBills(false); }, [fetchBills]);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    fetchBills(true);
  }, [fetchBills]));

  // Filter bills based on selected time period or date
  const filteredBills = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    return bills.filter(bill => {
      const promiseDate = bill.promise_date ? new Date(bill.promise_date) : null;
      if (!promiseDate) return false;
      
      promiseDate.setHours(0, 0, 0, 0);
      
      // No past dates
      if (promiseDate.getTime() < todayDate.getTime()) return false;

      const daysUntil = Math.ceil((promiseDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      // "All" shows promises up to 3 months (90 days)
      if (selectedFilter === 'all' && !selectedDate) {
        return daysUntil >= 0 && daysUntil <= 90;
      }

      // If specific date selected
      if (selectedDate) {
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);
        return promiseDate.getTime() === selected.getTime();
      }

      // If time period filter selected
      if (selectedFilter !== 'all') {
        const period = TIME_PERIODS.find(p => p.key === selectedFilter);
        if (period) {
          // Exact day matching - bills exactly N days from today
          return daysUntil === period.days;
        }
      }

      return true;
    });
  }, [bills, selectedFilter, selectedDate]);

  // Group bills by executive
  const executiveGroups = useMemo(() => {
    const groups = {};
    
    filteredBills.forEach(bill => {
  const execId = bill.executive_id ?? 'unassigned';
      const execName = bill.executive_name || bill.executive_username || 'Unassigned';
      
      if (!groups[execId]) {
        groups[execId] = {
          executive_id: execId,
          executive_name: execName,
          promise_count: 0,
          total_amount: 0,
          bills: []
        };
      }
      
      groups[execId].promise_count += 1;
      const outstanding = Number(bill.outstanding_amount || bill.amount || 0);
      groups[execId].total_amount += outstanding;
      groups[execId].bills.push(bill);
    });

    return Object.values(groups).sort((a, b) => b.promise_count - a.promise_count);
  }, [filteredBills]);

  const totalCount = filteredBills.length;
  const totalAmount = useMemo(() => {
    return filteredBills.reduce((sum, bill) => {
      const outstanding = Number(bill.outstanding_amount || bill.amount || 0);
      return sum + outstanding;
    }, 0);
  }, [filteredBills]);

  const handleExecutivePress = (executive) => {
    // Navigate to PromiseCompanies with executive and filter info
    router.push({
      pathname: '../(others)/PromiseCompanies',
      params: {
        execId: executive.executive_id,
        execUsername: executive.executive_name,
        filterType: selectedDate ? 'date' : 'period',
        filterValue: selectedDate || selectedFilter,
        promiseCount: executive.promise_count
      }
    });
  };

  const handleCalendarSelect = (day) => {
    setSelectedDate(day.dateString);
    setSelectedFilter('all'); // Clear period filter when date is selected
    setShowCalendar(false);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const renderExecutiveItem = (executive) => (
    <TouchableOpacity
      key={executive.executive_id}
      style={styles.execCard}
      activeOpacity={0.7}
      onPress={() => handleExecutivePress(executive)}
    >
      <Card style={styles.execCardInner}>
        <View style={styles.execHeader}>
          <View style={styles.execIconWrapper}>
            <Ionicons name="person" size={22} color={tokens.colors.accent} />
          </View>
          <View style={styles.execDetails}>
            <Text style={styles.execName}>{executive.executive_name}</Text>
            <Text style={styles.execMeta}>{executive.promise_count} promises</Text>
          </View>
          <View style={styles.execRight}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{executive.promise_count}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tokens.colors.textDim} style={{ marginTop: 4 }} />
          </View>
        </View>
        <View style={styles.execFooter}>
          <View style={styles.amountRow}>
            <Ionicons name="cash-outline" size={16} color={tokens.colors.accent} />
            <Text style={styles.amountLabel}>Expected:</Text>
            <Text style={styles.amountValue}>{formatCurrency(executive.total_amount)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen
      title="Upcoming Collections"
      subtitle="Select period or date"
      scroll
      backButton
    >
      {/* Calendar Button */}
      <View style={styles.calendarButtonRow}>
        <TouchableOpacity 
          style={styles.calendarButton}
          onPress={() => setShowCalendar(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={20} color={tokens.colors.accent} />
          <Text style={styles.calendarButtonText}>Select Date</Text>
        </TouchableOpacity>
        {selectedDate && (
          <View style={styles.selectedDateChip}>
            <Text style={styles.selectedDateText}>{formatDate(selectedDate)}</Text>
            <TouchableOpacity onPress={clearDateFilter} style={styles.clearDateBtn}>
              <Ionicons name="close-circle" size={18} color={tokens.colors.textDim} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Time Period Filters */}
      {!selectedDate && (
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
              const count = bills.filter((b) => {
                if (!b.promise_date) return false;
                const promiseDate = new Date(b.promise_date);
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                promiseDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((promiseDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

                // Exact day matching for badge counts
                return daysUntil === period.days;
              }).length;

              return (
                <TouchableOpacity
                  key={period.key}
                  style={[styles.filterBtn, selectedFilter === period.key && styles.filterBtnActive]}
                  onPress={() => { setSelectedFilter(period.key); setSelectedDate(null); }}
                >
                  <Text style={[styles.filterBtnText, selectedFilter === period.key && styles.filterBtnTextActive]}>
                    {period.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="people-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Executives</Text>
            <Text style={styles.summaryValue}>{executiveGroups.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="time-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Total Promises</Text>
            <Text style={styles.summaryValue}>{totalCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="cash-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Expected Amount</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.timestamp}>
            {selectedDate ? `Date: ${formatDate(selectedDate)}` : `Period: ${TIME_PERIODS.find(p => p.key === selectedFilter)?.label || 'All'}`}
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchBills(true)} disabled={refreshing}>
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
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBills(false)}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <>
          <View style={styles.executivesContainer}>
            {executiveGroups.map(exec => renderExecutiveItem(exec))}
          </View>
          {executiveGroups.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={48} color={tokens.colors.textDim} />
              <Text style={styles.emptyText}>No upcoming collections for selected period</Text>
            </Card>
          )}
        </>
      )}

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Promise Date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.text} />
              </TouchableOpacity>
            </View>
            <Calendar
              minDate={minDate}
              maxDate={maxDate}
              onDayPress={handleCalendarSelect}
              markedDates={selectedDate ? {
                [selectedDate]: { selected: true, selectedColor: tokens.colors.accent }
              } : {}}
              theme={{
                backgroundColor: tokens.colors.card,
                calendarBackground: tokens.colors.card,
                textSectionTitleColor: tokens.colors.textDim,
                selectedDayBackgroundColor: tokens.colors.accent,
                selectedDayTextColor: '#000',
                todayTextColor: tokens.colors.accent,
                dayTextColor: tokens.colors.text,
                textDisabledColor: tokens.colors.textFaint,
                monthTextColor: tokens.colors.text,
                textMonthFontWeight: '700',
                textDayFontSize: 14,
                textMonthFontSize: 16,
              }}
            />
          </View>
        </View>
      </Modal>

      <View style={{ marginBottom: 30 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.cardAlt,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 8,
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  selectedDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  selectedDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  clearDateBtn: {
    marginLeft: 4,
  },
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
    marginHorizontal: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: tokens.colors.textDim,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  executivesContainer: {
    gap: 12,
  },
  execCard: {
    marginBottom: 4,
  },
  execCardInner: {
    padding: 16,
  },
  execHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  execIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.cardAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  execDetails: {
    flex: 1,
  },
  execName: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
    marginBottom: 2,
  },
  execMeta: {
    fontSize: 13,
    color: tokens.colors.textDim,
  },
  execRight: {
    alignItems: 'center',
    gap: 4,
  },
  countBadge: {
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  execFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountLabel: {
    fontSize: 13,
    color: tokens.colors.textDim,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.accent,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  calendarCard: {
    backgroundColor: tokens.colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
});
