import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { onPaymentUpdate } from '../../src/events/paymentEvents';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

export default function AdminDashboard() {
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const router = useRouter();

  const navItems = [
    { label: 'Approve', icon: 'checkmark', route: '../(others)/NotifyAdmin' },
    { label: 'Companies', icon: 'business-outline', route: '../CompanyList/AllCompanies' },
    { label: 'Executives', icon: 'people-outline', route: '../(others)/ExecutiveList' },
    { label: 'Assignments', icon: 'git-branch-outline', route: '../(others)/CompanyAssignments' },
    { label: 'User Mgmt', icon: 'person-circle-outline', route: '../(others)/ManageUsers' },
    { label: 'Settings', icon: 'settings-outline', route: '../(others)/GlobalSettings' },
  ];

  const onPressItem = (item) => router.push(item.route);

  const fetchRecent = useCallback(async () => {
    let cancelled = false;
    setLoadingRecent(true);
    try {
      const token = await StorageService.getToken();
      const resp = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/payments/pending?skip=0&limit=6&_t=${Date.now()}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}` }
      });
      const json = await resp.json();
      if (!resp.ok) { console.log('recent payments error', json); return; }
      const items = json.items || [];
      const codes = Array.from(new Set(items.map(i => i.company_code).filter(Boolean)));
      const tokenVal = token.access_token;
      const companyMap = {};
      await Promise.all(codes.map(async code => {
        try {
          const r = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/companies/${code}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } });
          if (!r.ok) return; const cd = await r.json();
          companyMap[code] = cd?.account_n || cd?.companyName || cd?.name || code;
        } catch (_) { }
      }));
      if (cancelled) return;
      setRecentPayments(items.map(it => ({ ...it, companyName: companyMap[it.company_code] || it.company_code || 'Unknown' })));
    } catch (err) { console.log('recent fetch err', err); }
    finally { if (!cancelled) setLoadingRecent(false); }
    return () => { cancelled = true; };
  }, []);

  // Initial + interval refresh
  useEffect(() => {
    fetchRecent();
    const id = setInterval(fetchRecent, 30000); // 30s
    return () => clearInterval(id);
  }, [fetchRecent]);

  // Refresh when screen regains focus
  useFocusEffect(useCallback(() => {
    fetchRecent();
  }, [fetchRecent]));

  // Event-driven refresh after approve/decline
  useEffect(() => {
    const off = onPaymentUpdate(() => { fetchRecent(); });
    return off;
  }, [fetchRecent]);


  const gridColumns = 3;
  const navGrid = useMemo(() => navItems.map(it => it), [navItems]);

  const renderNavItem = ({ item }) => (
    <TouchableOpacity
      key={item.label}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={styles.navItem}
      onPress={() => onPressItem(item)}
      activeOpacity={0.85}
    >
      <View style={styles.navIconWrap}>
        <Ionicons name={item.icon} size={22} color="#000" />
      </View>
      <Text style={styles.navLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  const renderPayment = (item, index) => {
    const isLast = index === recentPayments.length - 1;
    return (
      <TouchableOpacity
        style={[styles.recentRow, isLast && styles.recentRowLast]}
        onPress={() => router.push('../(others)/NotifyAdmin')}
        activeOpacity={0.75}
      >
        <View style={styles.recentIcon}><Ionicons name="cash-outline" size={18} color={tokens.colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recentTitle} numberOfLines={1}>{item.companyName}</Text>
          <Text style={styles.recentMeta} numberOfLines={1}>{item.amount_collected ? `₹${item.amount_collected}` : 'No Amount'} • {item.collected_at ? new Date(item.collected_at).toLocaleDateString('en-IN') : 'Pending'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tokens.colors.textDim} />
      </TouchableOpacity>
    );
  };

  return (
    <Screen title="Dashboard" subtitle="Quick access & recent activity" scroll>
      <Card style={styles.navCard}>
        <FlatList
          data={navGrid}
          keyExtractor={i => i.label}
          renderItem={renderNavItem}
          numColumns={gridColumns}
          columnWrapperStyle={styles.navRow}
          scrollEnabled={false}
        />
      </Card>
      <View style={styles.sectionSpacer} />
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Payments</Text>
        <TouchableOpacity onPress={() => router.push('../(others)/NotifyAdmin')}><Text style={styles.sectionLink}>View All</Text></TouchableOpacity>
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
            renderItem={({ item, index }) => renderPayment(item, index)}
            scrollEnabled={false}
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
