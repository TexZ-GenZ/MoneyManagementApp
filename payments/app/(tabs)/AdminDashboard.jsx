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
import { API_BASE_URL } from '../../src/utils/constants';
import { formatDate } from '../../src/ui/format';
import { useNotificationsBadge } from '../../src/ui/hooks/useNotificationsBadge';
import { onBadgeChange } from '../../src/events/notificationsEvents';

export default function AdminDashboard() {
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [pendingTotal, setPendingTotal] = useState(0);
  const router = useRouter();
  const BASE = API_BASE_URL;
  const { unread, refreshUnread } = useNotificationsBadge();

  const navItems = [
    { label: 'Approve pending payments', icon: 'checkmark', route: '../(others)/NotifyAdmin' },
    { label: 'Promise Date', icon: 'calendar-outline', route: '../(others)/PromiseDate' },
    { label: 'Due Bills', icon: 'receipt-outline', route: '../(others)/ExecutiveList' },
  ];

  const onPressItem = (item) => router.push(item.route);

  const fetchRecent = useCallback(async () => {
    let cancelled = false;
    setLoadingRecent(true);
    try {
      const token = await StorageService.getToken();
      const resp = await fetch(`${BASE}/admin/payments/pending?skip=0&limit=6&_t=${Date.now()}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token.access_token}` }
      });
      const json = await resp.json();
      if (!resp.ok) { console.log('recent payments error', json); return; }
      const items = json.items || [];
      const total = typeof json.total === 'number' ? json.total : items.length;
      // Collect unique company codes & executive ids for enrichment
      const codes = Array.from(new Set(items.map(i => i.company_code).filter(Boolean)));
      const execIds = Array.from(new Set(items.map(i => i.executive_id).filter(Boolean)));
      const tokenVal = token.access_token;
      const companyMap = {};
      const execMap = {};
      // fetch companies
      await Promise.all(codes.map(async code => {
        try { const r = await fetch(`${BASE}/companies/${code}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } }); if (!r.ok) return; const cd = await r.json(); companyMap[code] = cd?.name || cd?.account_n || cd?.companyName || code; } catch (_) { }
      }));
      // fetch executives once; fallback to activity-derived names
      try {
        const eRes = await fetch(`${BASE}/admin/executives`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } });
        if (eRes.ok) {
          const list = await eRes.json();
          const arr = Array.isArray(list) ? list : (list?.items || []);
          arr.forEach(u => { if (u?.id != null) execMap[u.id] = u.username || u.name || `Exec ${u.id}`; });
        } else {
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
      if (cancelled) return;
      // Normalize allocations list (bill IDs)
      // Fetch detail for items without allocations to get bill ids (limit to first 6 so fine)
      await Promise.all(items.map(async it => {
        if (!it.allocations || !it.allocations.length) {
          try {
            const r = await fetch(`${BASE}/payments/${it.id}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenVal}` } });
            if (r.ok) {
              const det = await r.json();
              it.allocations = det.allocations || [];
            }
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
      setPendingTotal(total);
    } catch (err) { console.log('recent fetch err', err); }
    finally { if (!cancelled) setLoadingRecent(false); }
    return () => { cancelled = true; };
  }, []);

  // Only refresh on page load or navigation focus (interval removed)
  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // Refresh when screen regains focus
  useFocusEffect(useCallback(() => {
    fetchRecent();
    refreshUnread();
  }, [fetchRecent, refreshUnread]));

  // Event-driven refresh after approve/decline and badge changes
  useEffect(() => {
    const off = onPaymentUpdate(() => { fetchRecent(); });
    const offBadge = onBadgeChange(() => { refreshUnread(); });
    return () => { off(); offBadge(); };
  }, [fetchRecent, refreshUnread]);


  const gridColumns = 3;
  const navGrid = useMemo(() => navItems.map(it => it), [navItems]);

  const renderNavItem = ({ item }) => {
    const showBadge = (item.route?.includes('NotifyAdmin') || item.label.toLowerCase().startsWith('approve')) && pendingTotal > 0;
    const badgeText = pendingTotal > 99 ? '99+' : String(pendingTotal);
    return (
      <TouchableOpacity
        key={item.label}
        accessibilityRole="button"
        accessibilityLabel={showBadge ? `${item.label} (${pendingTotal} pending)` : item.label}
        style={styles.navItem}
        onPress={() => onPressItem(item)}
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
  };

  const renderPayment = (item, index) => {
    const isLast = index === recentPayments.length - 1;
    
    // Get status dots color
    const getStatusDots = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'pending' || s === 'submitted') {
        return { show: true, color: '#FF4D4F' }; // Red
      }
      if (s === 'accountant_approved') {
        return { show: true, color: '#FFD54F' }; // Yellow
      }
      if (s === 'admin_approved') {
        return { show: true, color: '#4CAC8A' }; // Green
      }
      return { show: false };
    };
    
    const statusDots = getStatusDots(item.status);
    
    return (
      <View style={[styles.recentRow, isLast && styles.recentRowLast]}>
        <View style={styles.recentIcon}><Ionicons name="cash-outline" size={18} color={tokens.colors.accent} /></View>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {statusDots.show && (
              <View style={{ flexDirection: 'row', gap: 3 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: statusDots.color }} />
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: statusDots.color }} />
              </View>
            )}
            <Text style={styles.recentTitle} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <Text style={styles.recentMeta} numberOfLines={1}>
            {item.billNumbers && item.billNumbers.length ? `Bill ${item.billNumbers.join(', ')}` : 'No Bill'} • {item.executiveName}
          </Text>
          <Text style={styles.recentAmountLine} numberOfLines={1}>
            {(Number(item.amount_collected) === 0 && item.next_promise_date) ? 'Change in promise date' : (item.amount_collected ? `₹${item.amount_collected}` : 'No Amount')}
            {item.collected_at ? ` • ${formatDate(item.collected_at)}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.detailBtn} onPress={() => router.push({ pathname: '../(others)/PaymentApprovalDetail', params: { payment_id: item.id } })}>
          <Text style={styles.detailBtnText}>Detail</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Screen
      title={null}
      scroll
      hideBackButton
      hideTopBar={true}
      header={(
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Quick access & recent activity</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => { router.push('../(others)/NavigationSettings'); }} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Navigation Settings">
              <Ionicons name="grid-outline" size={22} color={tokens.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { router.push('../(others)/Notifications'); }} style={styles.bellWrap} accessibilityRole="button" accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={22} color={tokens.colors.text} />
              {unread > 0 && (
                <View style={styles.bellBadge} pointerEvents="none">
                  <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    >
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
        <Text style={styles.sectionTitle}>Payments to Approve</Text>
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

      <View style={{ marginBottom: 30 }}></View>
    </Screen>
  );
}


const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: tokens.colors.text },
  headerSubtitle: { fontSize: 14, color: tokens.colors.textDim, marginTop: 4 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 8, marginLeft: 4 },
  bellWrap: { position: 'relative', padding: 8, marginLeft: 4 },
  bellBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: tokens.colors.accent, borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#000' },
  bellBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },
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
