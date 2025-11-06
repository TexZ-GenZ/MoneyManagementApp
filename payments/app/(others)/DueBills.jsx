import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { API_BASE_URL } from '../../src/utils/constants';
import { formatCurrency, formatDate } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';

const TIME_PERIODS = [
  { key: '0-1w', label: '0-1 Week', minDays: 0, maxDays: 7 },
  { key: '1w-1m', label: '1 Week-1 Month', minDays: 7, maxDays: 30 },
  { key: '1-3m', label: '1-3 Months', minDays: 30, maxDays: 90 },
  { key: '3-6m', label: '3-6 Months', minDays: 90, maxDays: 180 },
  { key: '6m-1y', label: '6 Months-1 Year', minDays: 180, maxDays: 365 },
  { key: '1y+', label: '1 Year+', minDays: 365, maxDays: Infinity },
];

export default function DueBillsScreen() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const fetchCompanies = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const header = await StorageService.getAuthHeader();
      
      // Fetch all executives
      const execResponse = await fetch(`${API_BASE_URL}/admin/executives`, {
        headers: header,
      });

      if (!execResponse.ok) {
        throw new Error('Failed to load executives');
      }

      const executives = await execResponse.json();
      
      // For each executive, fetch their companies
      const execWithCompanies = await Promise.all(
        executives.map(async (exec) => {
          try {
            const compResponse = await fetch(
              `${API_BASE_URL}/executives/${exec.id}/companies`,
              { headers: header }
            );
            
            if (!compResponse.ok) return null;
            
            const companiesData = await compResponse.json();
            
            // Backend returns {items: [], total: number} structure
            const companiesList = companiesData.items || companiesData;
            
            // Ensure we have an array
            if (!Array.isArray(companiesList)) {
              console.error(`Invalid companies data for executive ${exec.id}:`, companiesData);
              return null;
            }
            
            // Filter only companies with overdue or pending bills
            const dueCompanies = companiesList.filter(c => 
              (c.overdue_count && c.overdue_count > 0) || (c.pending_count && c.pending_count > 0)
            );
            
            if (dueCompanies.length === 0) return null;
            
            return {
              executive_id: exec.id,
              executive_name: exec.username,
              companies: dueCompanies,
            };
          } catch (err) {
            console.error(`Failed to load companies for executive ${exec.id}`, err);
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validExecs = execWithCompanies.filter(e => e !== null);
      setCompanies(validExecs);
    } catch (err) {
      console.error('Failed to load data', err);
      setError('Could not load due bills data. Pull to refresh.');
      setCompanies([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCompanies(false);
    }, [fetchCompanies])
  );

  // Calculate days overdue for each company based on next_due_date from backend
  const companiesWithDueDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return companies.map(exec => ({
      ...exec,
      companies: exec.companies.map(company => {
        if (!company.next_due_date) return { ...company, daysOverdue: null };
        
        const dueDate = new Date(company.next_due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = today - dueDate;
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return { ...company, daysOverdue };
      })
    }));
  }, [companies]);

  // Filter companies based on selected period
  const filteredCompanies = useMemo(() => {
    if (selectedFilter === 'all') {
      return companiesWithDueDays;
    }
    
    const period = TIME_PERIODS.find(p => p.key === selectedFilter);
    if (!period) return companiesWithDueDays;
    
    // Filter companies where daysOverdue is within the range [minDays, maxDays)
    return companiesWithDueDays.map(exec => ({
      ...exec,
      companies: exec.companies.filter(c => 
        c.daysOverdue !== null && 
        c.daysOverdue >= period.minDays && 
        c.daysOverdue < period.maxDays
      )
    })).filter(exec => exec.companies.length > 0); // Remove executives with no matching companies
  }, [companiesWithDueDays, selectedFilter]);

  // Group by executive (already grouped from API)
  const executiveGroups = useMemo(() => {
    return filteredCompanies.map(exec => ({
      executive_id: exec.executive_id,
      executive_name: exec.executive_name,
      company_count: exec.companies.length,
      total_overdue: exec.companies.reduce((sum, c) => sum + Number(c.outbal || 0), 0),
      companies: exec.companies,
    })).sort((a, b) => b.company_count - a.company_count);
  }, [filteredCompanies]);

  const handleExecutivePress = (executive) => {
    router.push({
      pathname: '../(others)/DueCompanies',
      params: {
        execId: executive.executive_id,
        execName: executive.executive_name,
        filterType: selectedFilter,
      }
    });
  };

  const renderExecutive = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleExecutivePress(item)}
      activeOpacity={0.7}
      style={styles.executiveCard}
    >
      <Card style={styles.card}>
        <View style={styles.executiveHeader}>
          <View style={styles.executiveIconContainer}>
            <Ionicons name="person" size={24} color={tokens.colors.accent} />
          </View>
          <View style={styles.executiveInfo}>
            <Text style={styles.executiveName}>{item.executive_name}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Ionicons name="business-outline" size={14} color={tokens.colors.accent} />
                <Text style={styles.badgeText}>{item.company_count} Companies</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={tokens.colors.textDim} />
        </View>
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Total Overdue:</Text>
            <Text style={styles.amountValue}>{formatCurrency(item.total_overdue)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen
      title="Due Bills"
      subtitle="Companies with overdue/pending bills"
      backButton
      scroll={false}
    >
      {/* Filter Buttons */}
      {!loading && !error && (
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
                All ({companiesWithDueDays.reduce((sum, exec) => sum + exec.companies.length, 0)})
              </Text>
            </TouchableOpacity>

            {TIME_PERIODS.map((period) => {
              // Calculate count for this specific period range
              const periodCompaniesCount = companiesWithDueDays.reduce((total, exec) => {
                const matching = exec.companies.filter(c => 
                  c.daysOverdue !== null && 
                  c.daysOverdue >= period.minDays && 
                  c.daysOverdue < period.maxDays
                );
                return total + matching.length;
              }, 0);

              return (
                <TouchableOpacity
                  key={period.key}
                  style={[styles.filterBtn, selectedFilter === period.key && styles.filterBtnActive]}
                  onPress={() => setSelectedFilter(period.key)}
                >
                  <Text style={[styles.filterBtnText, selectedFilter === period.key && styles.filterBtnTextActive]}>
                    {period.label} ({periodCompaniesCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={tokens.colors.accent} size="large" />
        </Card>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="warning-outline" size={32} color={tokens.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCompanies(false)}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <FlatList
          data={executiveGroups}
          keyExtractor={(item) => String(item.executive_id)}
          renderItem={renderExecutive}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCompanies(true)}
              tintColor={tokens.colors.accent}
            />
          }
          ListEmptyComponent={() => (
            <Card style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={48} color={tokens.colors.success} />
              <Text style={styles.emptyText}>No due bills found!</Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.textDim,
  },
  filterBtnTextActive: {
    color: '#000',
  },
  listContent: {
    paddingBottom: 20,
  },
  executiveCard: {
    marginBottom: 12,
  },
  card: {
    padding: 16,
  },
  executiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  executiveIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  executiveInfo: {
    flex: 1,
  },
  executiveName: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.text,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    color: tokens.colors.textDim,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '900',
    color: tokens.colors.danger,
  },
  loadingCard: {
    padding: 40,
    alignItems: 'center',
  },
  errorCard: {
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: tokens.colors.text,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.textDim,
    marginTop: 12,
  },
});
