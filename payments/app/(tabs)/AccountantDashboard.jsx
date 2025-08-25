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
import { API_BASE_URL } from '../../src/utils/constants';

export default function AccountantDashboard() {
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [pendingTotal, setPendingTotal] = useState(0);
  const router = useRouter();
  const BASE = API_BASE_URL;

  const navItems = [
    { label: 'Approve pending payments', icon: 'checkmark', route: '../(others)/NotifyAccountant' },
    { label: 'companies list', icon: 'business-outline', route: '../CompanyList/AllCompanies' },
    { label: 'executive wise company info', icon: 'people-outline', route: '../(others)/ExecutiveList' },
    { label: 'Upload', icon: 'add-circle-outline', route: '../(others)/Upload' },
  ];

  const fetchRecent = useCallback(async () => {
    let cancelled = false;
    setLoadingRecent(true);
    try {
      const token = await StorageService.getToken();
      const response = await fetch(`${BASE}/accountant/payments/pending?skip=0&limit=6&_t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}` },
      });
      const json = await response.json();
      const items = json?.items || [];
      if (!cancelled && response.ok && Array.isArray(items)) {
        // Enrich with company + executive + bill ids
        const codes = Array.from(new Set(items.map(i => i.company_code).filter(Boolean)));
        const execIds = Array.from(new Set(items.map(i => i.executive_id).filter(Boolean)));
        const tokenVal = token.access_token;
        const companyMap = {};
        const execMap = {};
        await Promise.all(codes.map(async code => {
          try { const r = await fetch(`${BASE}/companies/${code}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } }); if (!r.ok) return; const cd = await r.json(); companyMap[code] = cd?.name || cd?.account_n || cd?.companyName || code; } catch (_) { }
        }));
        // Fetch executive names in one call (accountant-accessible), fallback to activity
        try {
          const eRes = await fetch(`${BASE}/admin/executives`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } });
          if (eRes.ok) {
            const list = await eRes.json();
            const arr = Array.isArray(list) ? list : (list?.items || []);
            arr.forEach(u => { if (u?.id != null) execMap[u.id] = u.username || u.name || `Exec ${u.id}`; });
          } else {
            // Fallback to activity-derived names
            const aRes = await fetch(`${BASE}/payments/activity?limit=500`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } });
            if (aRes.ok) {
              const data = await aRes.json();
              const actItems = Array.isArray(data.items) ? data.items : [];
              actItems.forEach(it => {
                const id = it.executive_id || it.executiveId;
                if (id != null && execMap[id] == null) execMap[id] = it.executive_name || it.executive_username || it.executive || `Exec ${id}`;
              });
            }
          }
        } catch (_) { }
        // Pull detail for any item missing allocations
        await Promise.all(items.map(async it => {
          if (!it.allocations || !it.allocations.length) {
            try {
              const r = await fetch(`${BASE}/payments/${it.id}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } });
              if (r.ok) { const det = await r.json(); it.allocations = det.allocations || []; }
            } catch (_) { }
          }
        }));
        const enriched = items.map(it => ({
          ...it,
          companyName: companyMap[it.company_code] || it.company_code || 'Unknown',
          executiveName: execMap[it.executive_id] || '—',
          billNumbers: (it.allocations || []).map(a => a.bill_number || a.bill_id).filter(Boolean)
        }));
        setRecentPayments(enriched);
        setPendingTotal(typeof json.total === 'number' ? json.total : items.length);
      }
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
    <Screen scroll title="Accountant" subtitle="Quick access & recent activity" hideBackButton hideTopBar contentStyle={{paddingTop: 20}}>
      <Card style={styles.navCard}>
        <FlatList
          data={navItems}
          keyExtractor={i => i.label}
          numColumns={3}
          columnWrapperStyle={styles.navRow}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const showBadge = (item.route?.includes('NotifyAccountant') || item.label.toLowerCase().startsWith('approve')) && pendingTotal > 0;
            const badgeText = pendingTotal > 99 ? '99+' : String(pendingTotal);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={showBadge ? `${item.label} (${pendingTotal} pending)` : item.label}
                style={styles.navItem}
                onPress={() => router.push(item.route)}
                activeOpacity={0.85}
              >
                <View style={styles.navIconWrap}>
                  <Ionicons name={item.icon} size={22} color="#000" />
                  {showBadge && (
                    <View style={styles.badge} pointerEvents="none">
                      <Text style={styles.badgeText}>{badgeText}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.navLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
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
                <View style={[styles.recentRow, isLast && styles.recentRowLast]}>
                  <View style={styles.recentIcon}><Ionicons name="cash-outline" size={18} color={tokens.colors.accent} /></View>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{item.companyName}</Text>
                    <Text style={styles.recentMeta} numberOfLines={1}>{item.billNumbers && item.billNumbers.length ? `Bill ${item.billNumbers.join(', ')}` : 'No Bill'} • {item.executiveName}</Text>
                    <Text style={styles.recentAmountLine} numberOfLines={1}>{item.amount_collected ? `₹${item.amount_collected}` : 'No Amount'}{item.status ? ` • ${item.status}` : ''}</Text>
                  </View>
                  <TouchableOpacity style={styles.detailBtn} onPress={() => router.push({ pathname: '../(others)/PaymentApprovalDetail', params: { payment_id: item.id } })}>
                    <Text style={styles.detailBtnText}>Detail</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </Card>
    </Screen>
  );

}

const styles = StyleSheet.create({
  navCard: { paddingVertical: 20, paddingHorizontal: 10 },
  navRow: { justifyContent: 'space-between', marginBottom: 18 },
  navItem: { width: '32%', alignItems: 'center', paddingVertical: 14, borderRadius: 18, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border },
  navIconWrap: { backgroundColor: tokens.colors.accent, padding: 12, borderRadius: 30, marginBottom: 6 },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 12, backgroundColor: tokens.colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#000' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  navLabel: { color: tokens.colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 0.3 },
  sectionSpacer: { height: 28 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.4 },
  sectionLink: { color: tokens.colors.accent, fontSize: 13, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 4 },
  recentCard: { paddingVertical: 4, paddingHorizontal: 0, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: tokens.colors.border },
  recentRowLast: { borderBottomWidth: 0 },
  recentIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: tokens.colors.cardAlt, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  recentTitle: { color: tokens.colors.text, fontSize: 15, fontWeight: '600' },
  recentMeta: { color: tokens.colors.textDim, fontSize: 11, marginTop: 3 },
  recentAmountLine: { color: tokens.colors.text, fontSize: 12, fontWeight: '600', marginTop: 4 },
  detailBtn: { backgroundColor: tokens.colors.accent, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, alignSelf: 'center' },
  detailBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  loadingWrap: { paddingVertical: 36 },
  emptyText: { color: tokens.colors.textDim, fontSize: 13, padding: 20 },
});
