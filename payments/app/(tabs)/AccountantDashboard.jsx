import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { onPaymentUpdate } from '../../src/events/paymentEvents';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

export default function AccountantDashboard() {
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const router = useRouter();

  const navItems = [
    { label: 'Approve', icon: 'checkmark', route: '../(others)/NotifyAccountant' },
    { label: 'Companies', icon: 'business-outline', route: '../CompanyList/AllCompanies' },
    { label: 'Executives', icon: 'people-outline', route: '../(others)/ExecutiveList' },
    { label: 'Upload', icon: 'add-circle-outline', route: '../(others)/Upload' },
  ];

  const fetchRecent = useCallback(async () => {
    let cancelled = false;
    setLoadingRecent(true);
    try {
      const token = await StorageService.getToken();
      const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/accountant/payments/pending?skip=0&limit=6&_t=${Date.now()}` , {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}` },
      });
      const json = await response.json();
      const items = json?.items || [];
      if (!cancelled && response.ok && Array.isArray(items)) setRecentPayments(items);
    } catch (err) { console.error('Payments fetch error:', err); }
    finally { if (!cancelled) setLoadingRecent(false); }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchRecent();
    const id = setInterval(fetchRecent, 30000);
    return () => clearInterval(id);
  }, [fetchRecent]);

  useFocusEffect(useCallback(() => { fetchRecent(); }, [fetchRecent]));

  useEffect(() => { const off = onPaymentUpdate(() => fetchRecent()); return off; }, [fetchRecent]);

  return (
    <Screen title="Accountant" subtitle="Quick access & recent activity">
      <Card style={styles.navCard}>
        <FlatList
          data={navItems}
          keyExtractor={i => i.label}
          numColumns={3}
          columnWrapperStyle={styles.navRow}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={styles.navItem}
              onPress={() => router.push(item.route)}
              activeOpacity={0.85}
            >
              <View style={styles.navIconWrap}><Ionicons name={item.icon} size={22} color="#000" /></View>
              <Text style={styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </Card>
      <View style={styles.sectionSpacer} />
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Payments</Text>
        <TouchableOpacity onPress={() => router.push('../(others)/NotifyAccountant')}><Text style={styles.sectionLink}>View All</Text></TouchableOpacity>
      </View>
      <Card style={styles.recentCard}>
        {loadingRecent ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={tokens.colors.accent} /></View>
        ) : recentPayments.length === 0 ? (
          <Text style={styles.emptyText}>No recent pending payments.</Text>
        ) : (
          <FlatList
            data={recentPayments}
            keyExtractor={(item, idx) => idx.toString()}
            scrollEnabled={false}
            renderItem={({ item, index }) => {
              const isLast = index === recentPayments.length - 1;
              return (
                <TouchableOpacity
                  style={[styles.recentRow, isLast && styles.recentRowLast]}
                  onPress={() => router.push('../(others)/NotifyAccountant')}
                  activeOpacity={0.75}
                >
                  <View style={styles.recentIcon}><Ionicons name="cash-outline" size={18} color={tokens.colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{item.company_code}</Text>
                    <Text style={styles.recentMeta} numberOfLines={1}>{item.amount_collected ? `₹${item.amount_collected}` : 'No Amount'} • {item.status || 'Pending'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={tokens.colors.textDim} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </Card>
    </Screen>
  );

}

const styles = StyleSheet.create({
  navCard: { paddingVertical: 20, paddingHorizontal: 8 },
  navRow: { justifyContent: 'space-between', marginBottom: 16 },
  navItem: { width: '32%', alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#111', borderWidth: 1, borderColor: tokens.colors.border },
  navIconWrap: { backgroundColor: tokens.colors.accent, padding: 12, borderRadius: 28, marginBottom: 6 },
  navLabel: { color: tokens.colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  sectionSpacer: { height: 28 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: tokens.colors.text, fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  sectionLink: { color: tokens.colors.accent, fontSize: 12, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 4 },
  recentCard: { paddingVertical: 4, paddingHorizontal: 0, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: tokens.colors.border },
  recentRowLast: { borderBottomWidth: 0 },
  recentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.colors.cardAlt, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  recentTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '600' },
  recentMeta: { color: tokens.colors.textDim, fontSize: 11, marginTop: 3 },
  loadingWrap: { paddingVertical: 34 },
  emptyText: { color: tokens.colors.textDim, fontSize: 12, padding: 18 },
});
