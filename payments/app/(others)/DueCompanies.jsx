import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { API_BASE_URL } from '../../src/utils/constants';
import { formatCurrency, formatDate } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';

export default function DueCompaniesScreen() {
  const router = useRouter();
  const { execId, execName, filterType } = useLocalSearchParams();
  
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCompanies = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const header = await StorageService.getAuthHeader();
      
      // Fetch companies for this executive
      const url = `${API_BASE_URL}/executives/${execId}/companies`;
      
      const response = await fetch(url, { headers: header });

      if (!response.ok) {
        throw new Error('Failed to load companies');
      }

      const companiesData = await response.json();
      
      // Backend returns {items: [], total: number} structure
      const companiesList = companiesData.items || companiesData;
      
      // Ensure we have an array
      if (!Array.isArray(companiesList)) {
        console.error('Invalid companies data:', companiesData);
        throw new Error('Invalid data format received from server');
      }
      
      // Filter only companies with overdue or pending bills
      const filtered = companiesList.filter(c => 
        (c.overdue_count && c.overdue_count > 0) || (c.pending_count && c.pending_count > 0)
      );
      
      setCompanies(filtered);
    } catch (err) {
      console.error('Failed to load companies', err);
      setError('Could not load company data. Pull to refresh.');
      setCompanies([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [execId]);

  useFocusEffect(
    useCallback(() => {
      fetchCompanies(false);
    }, [fetchCompanies])
  );

  const totalCompanies = companies.length;
  const totalOverdue = useMemo(() => {
    return companies.reduce((sum, company) => {
      return sum + Number(company.outbal || 0);
    }, 0);
  }, [companies]);

  const handleCompanyPress = (company) => {
    router.push({
      pathname: '../(others)/BiilsScreen',
      params: {
        name: company.name,
        code: company.code,
        amount: company.amount,
        outbal: company.outbal,
      }
    });
  };

  const renderCompany = ({ item }) => {
    const overdueCount = item.overdue_count || 0;
    const pendingCount = item.pending_count || 0;
    const outbal = Number(item.outbal || 0);

    return (
      <TouchableOpacity
        onPress={() => handleCompanyPress(item)}
        activeOpacity={0.7}
        style={styles.companyCard}
      >
        <Card style={styles.card}>
          <View style={styles.companyHeader}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.companyCode}>Code: {item.code}</Text>
              {item.area && (
                <View style={styles.areaBadge}>
                  <Text style={styles.areaBadgeText}>{item.area}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.colors.textDim} />
          </View>
          
          {/* Next Due Date Badge */}
          {item.next_due_date && (
            <View style={styles.promiseDateBadge}>
              <Ionicons name="calendar-outline" size={14} color={tokens.colors.accent} />
              <Text style={styles.promiseDateText}>Next Due: {formatDate(item.next_due_date)}</Text>
            </View>
          )}
          
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>OUTBAL</Text>
              <Text style={[styles.metricValue, outbal > 0 && styles.dangerValue]}>
                {formatCurrency(outbal)}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>OVERDUE</Text>
              <Text style={[styles.metricValue, overdueCount > 0 && styles.dangerValue]}>
                {overdueCount}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>PENDING</Text>
              <Text style={[styles.metricValue, styles.warningValue]}>
                {pendingCount}
              </Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <Screen
      title={execName || 'Companies'}
      subtitle={`Due bills - ${filterType === 'all' ? 'All periods' : filterType}`}
      backButton
      scroll={false}
    >
      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="business-outline" size={20} color={tokens.colors.accent} />
            <Text style={styles.summaryLabel}>Companies</Text>
            <Text style={styles.summaryValue}>{totalCompanies}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="alert-circle-outline" size={20} color={tokens.colors.danger} />
            <Text style={styles.summaryLabel}>Total Overdue</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalOverdue)}</Text>
          </View>
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
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCompanies(false)}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => String(item.code)}
          renderItem={renderCompany}
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
              <Text style={styles.emptyText}>No companies with due bills!</Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginBottom: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: tokens.colors.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: tokens.colors.textDim,
    fontWeight: '600',
    marginTop: 6,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: tokens.colors.text,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  companyCard: {
    marginBottom: 12,
  },
  card: {
    padding: 16,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.text,
    marginBottom: 4,
  },
  companyCode: {
    fontSize: 13,
    color: tokens.colors.textDim,
    fontWeight: '600',
    marginBottom: 6,
  },
  areaBadge: {
    backgroundColor: tokens.colors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  areaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  promiseDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  promiseDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: tokens.colors.cardAlt,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.textDim,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    color: tokens.colors.text,
  },
  dangerValue: {
    color: tokens.colors.danger,
  },
  warningValue: {
    color: tokens.colors.warning || '#f5b100',
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
