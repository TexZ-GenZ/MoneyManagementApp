import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { formatCurrency, formatDate } from '../../src/ui/format';
import { StorageService } from '../../src/services/storageService';
import { API_BASE_URL } from '../../src/utils/constants';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as Location from 'expo-location';
import { emitPaymentUpdate } from '../../src/events/paymentEvents';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MultiPayScreen() {
  const { code, name, amount } = useLocalSearchParams();
  const router = useRouter();
  const initialTotal = Math.max(0, Number(amount || 0));
  const insets = useSafeAreaInsets();
  // Ensure comfortable bottom space even when safe-area inset is 0 (e.g., Android 3-button nav)
  const DEFAULT_BOTTOM_PADDING_IOS = 12;
  const DEFAULT_BOTTOM_PADDING_ANDROID = 20;
  const CLAMP_MAX_IOS = 24;
  const CLAMP_MAX_ANDROID = 28;
  const EXTRA_FLOATING_PADDING = 8;
  const rawInset = insets.bottom && insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? DEFAULT_BOTTOM_PADDING_IOS : DEFAULT_BOTTOM_PADDING_ANDROID);
  const bottomInset = Math.min(rawInset, Platform.OS === 'ios' ? CLAMP_MAX_IOS : CLAMP_MAX_ANDROID);
  // No custom keyboard listeners; we rely on KeyboardAvoidingView and a safe-area bottom inset
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(initialTotal);
  const [selected, setSelected] = useState({}); // bill_id -> allocated amount
  const [promiseDate, setPromiseDate] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationErrorMsg, setLocationErrorMsg] = useState("");
  const [comment, setComment] = useState('');
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('oldest'); // oldest | newest | amount_desc | amount_asc
  // Filters are always visible; no toggle state

  // Fetch bills (refetch when sort changes to get the right page from backend)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const tok = await StorageService.getToken();
        const sortMap = { oldest: 'oldest', newest: 'recent', amount_desc: 'amount_desc', amount_asc: 'amount_desc' };
        const serverSort = sortMap[sortBy] || 'recent';
        const url = `${API_BASE_URL}/companies/${code}/bills?status=pending&sort=${serverSort}&limit=500`;
        const r = await fetch(url, { headers: { 'Authorization': tok ? `Bearer ${tok.access_token}` : '' } });
        const data = await r.json();
        let items = Array.isArray(data.items) ? data.items : [];
        // If user selected amount ascending, sort client-side asc after fetching desc
        if (sortBy === 'amount_asc') {
          items = items.slice().sort((a, b) => (Number(a.amount) - Number(a.amount_paid)) - (Number(b.amount) - Number(b.amount_paid)));
        }
        setBills(items);
      } catch (_) { }
      finally { setLoading(false); }
    })();
  }, [code, sortBy]);

  // Location capture & enforcement (mandatory like PaymentScreen)
  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        setLocationErrorMsg('Location permission denied. Please enable location to proceed.');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 10000 });
        setLocation(loc.coords);
        setLocationError(false);
        setLocationErrorMsg('');
      } catch (err) {
        setLocationError(true);
        setLocationErrorMsg('Unable to get your current location. Please ensure GPS is enabled and try again.');
      }
    } catch (err) {
      setLocationError(true);
      setLocationErrorMsg('Location permission denied. Please enable location to proceed.');
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => { fetchLocation(); }, []);

  // Recompute remaining from selections
  const recomputeRemaining = () => {
    const totalAlloc = Object.values(selected).reduce((s, v) => s + (Number(v) || 0), 0);
    setRemaining(Math.max(0, initialTotal - totalAlloc));
  };
  useEffect(() => { recomputeRemaining(); }, [selected]);

  // Toggle selection applying greedy logic
  const toggleBill = (b) => {
    const rem = remaining;
    const outstanding = Math.max(0, Number(b.amount) - Number(b.amount_paid));
    const currently = Number(selected[b.id] || 0);
    const sel = { ...selected };

    if (currently > 0) {
      // unselect
      delete sel[b.id];
      setSelected(sel);
      return;
    }
    // select
    if (outstanding <= rem) {
      sel[b.id] = outstanding; // full
      setSelected(sel);
      return;
    }
    // partial -> allocate remaining
    if (rem > 0) {
      sel[b.id] = rem;
      setSelected(sel);
      // require promise date
      setPickerVisible(true);
    }
  };

  // When unselecting others might allow upgrading a partial to full; handle by re-greedy normalize
  useEffect(() => {
    // Normalize: iterate bills by oldest and try to upgrade partials to full if room
    let rem = initialTotal - Object.values(selected).reduce((s, v) => s + Number(v || 0), 0);
    if (rem <= 0) return; // nothing to upgrade
    const ordered = bills.slice().sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
    const nextSel = { ...selected };
    for (const b of ordered) {
      const out = Math.max(0, Number(b.amount) - Number(b.amount_paid));
      const alloc = Number(nextSel[b.id] || 0);
      if (alloc > 0 && alloc < out && rem >= (out - alloc)) {
        const delta = out - alloc;
        nextSel[b.id] = out;
        rem -= delta;
      }
      if (rem <= 0) break;
    }
    if (JSON.stringify(nextSel) !== JSON.stringify(selected)) setSelected(nextSel);
  }, [bills, initialTotal, selected]);

  const canSubmit = remaining === 0 && Object.keys(selected).length > 0 && (!needsPromise() || !!promiseDate) && !!location;

  function needsPromise() {
    // Needs promise if any allocation is partial on that bill
    return Object.entries(selected).some(([id, val]) => {
      const b = bills.find(x => x.id === Number(id));
      const out = b ? Math.max(0, Number(b.amount) - Number(b.amount_paid)) : 0;
      return Number(val) < out;
    });
  }

  const submit = async () => {
    if (remaining !== 0) { Alert.alert('Use Full Amount', 'Remaining must be 0 before submitting'); return; }
    if (needsPromise() && !promiseDate) { Alert.alert('Promise Required', 'Please choose next promise date for partial selection'); return; }
    if (!location) { Alert.alert('Location Needed', 'Enable and capture location before submitting.'); return; }
    setSubmitting(true);
    try {
      const tok = await StorageService.getToken();
      // Normalize to 2 decimal places for backend Decimal precision
      const to2 = (n) => Number((Number(n || 0)).toFixed(2));
      const payload = {
        company_code: code,
        collected_at: new Date().toISOString(),
        amount_collected: to2(initialTotal),
        method: method,
        comments: comment || undefined,
        next_promise_date: promiseDate ? promiseDate.toISOString().slice(0, 10) : undefined,
        bill_allocations: Object.entries(selected).map(([bill_id, amount]) => ({ bill_id: Number(bill_id), amount: to2(amount) })),
      };
      if (location?.latitude && location?.longitude) {
        payload.exec_lat = location.latitude; payload.exec_lng = location.longitude;
        payload.exec_location_verified = true;
      }
      // Simple idempotency using timestamp+company
      const idem = `bulk-${code}-${Date.now()}`;
      const r = await fetch(`${API_BASE_URL}/payments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': tok ? `Bearer ${tok.access_token}` : '', 'Idempotency-Key': idem },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        let errText = '';
        try { errText = await r.text(); } catch { }
        throw new Error(errText || `HTTP ${r.status}`);
      }
      await r.json().catch(() => null);
      Alert.alert('Success', 'Bulk payment submitted');
      emitPaymentUpdate({ type: 'submitted' });
      router.back();
    } catch (e) {
      console.log('Bulk submit error', e?.message || e);
      const raw = String(e?.message || '').slice(0, 500);
      let friendly = raw;
      if (/Allocation exceeds bill remaining amount/i.test(raw)) {
        friendly = 'One of the selected bills has less remaining than allocated, likely due to another pending submission.';
      } else if (/Allocation total must equal amount_collected/i.test(raw)) {
        friendly = 'Allocated sum must exactly equal the total amount.';
      } else if (/next_promise_date cannot be in the past/i.test(raw)) {
        friendly = 'Promise date cannot be in the past.';
      }
      Alert.alert('Error', friendly || 'Failed to submit bulk payment');
    } finally { setSubmitting(false); }
  };

  const visibleBills = useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    const filtered = bills.filter(b => {
      if (!query.trim()) return true;
      const q = norm(query.trim());
      return norm(b.bill_number).includes(q);
    });
    const sortKey = (b) => ({
      oldest: new Date(b.bill_date).getTime(),
      newest: -new Date(b.bill_date).getTime(),
      amount_desc: -(Number(b.amount) - Number(b.amount_paid)),
      amount_asc: (Number(b.amount) - Number(b.amount_paid))
    })[sortBy] ?? new Date(b.bill_date).getTime();
    return filtered.slice().sort((a, b) => sortKey(a) - sortKey(b));
  }, [bills, query, sortBy]);

  const renderBill = ({ item }) => {
    const out = Math.max(0, Number(item.amount) - Number(item.amount_paid));
    const selAmt = Number(selected[item.id] || 0);
    const selectedFlag = selAmt > 0;
    const effectivePromise = item?.promise_date || item?.due_date; // fallback like detail screen
    const isPromiseOverdue = (() => {
      if (!effectivePromise) return false;
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const d = new Date(effectivePromise); if (isNaN(d.getTime())) return false; d.setHours(0, 0, 0, 0);
        return d.getTime() <= today.getTime();
      } catch { return false; }
    })();
    const promiseStyle = [
      styles.dateText,
      effectivePromise ? (isPromiseOverdue ? styles.promiseOverdue : styles.promiseUpcoming) : null,
    ];
    return (
      <TouchableOpacity onPress={() => toggleBill(item)} activeOpacity={0.8}>
        <Card style={[styles.bill, selectedFlag && styles.billSelected]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.billNumber}>{item.bill_number}</Text>
            <Text style={styles.outstanding}>{formatCurrency(out)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>Bill: {formatDate(item.bill_date)}</Text>
            <Text style={promiseStyle}>Promise: {effectivePromise ? formatDate(effectivePromise) : '—'}</Text>
          </View>
          {selectedFlag ? (
            <Text style={styles.selText}>Paying: {formatCurrency(selAmt)}{selAmt < out ? ' (partial)' : ''}</Text>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <Screen title="Multi Pay" subtitle={`${name || ''} (${code})`}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 + insets.top : 100}>
        {loading ? <ActivityIndicator color={tokens.colors.accent} style={{ marginTop: 40 }} /> : (
          <>
            <FlatList
              data={visibleBills}
              keyExtractor={it => String(it.id)}
              renderItem={renderBill}
              ListHeaderComponent={(
                <>
                  <Card style={{ marginBottom: 8, padding: 10 }}>
                    <Text style={styles.remLabel}>Total</Text>
                    <Text style={styles.remValue}>{formatCurrency(initialTotal)}</Text>
                    <Text style={[styles.remLabel, { marginTop: 6 }]}>Remaining</Text>
                    <Text style={[styles.remValue, { color: remaining === 0 ? tokens.colors.success : tokens.colors.danger }]}>{formatCurrency(remaining)}</Text>
                    {needsPromise() ? (
                      <View style={{ marginTop: 10 }}>
                        <TouchableOpacity style={styles.promiseBtn} onPress={() => setPickerVisible(true)}>
                          <Text style={styles.promiseBtnText}>{promiseDate ? `Promise: ${formatDate(promiseDate)}` : 'Set Promise Date'}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </Card>
                  <Card style={{ marginBottom: 8, padding: 10 }}>
                    <TextInput
                      placeholder="Search bills by number"
                      placeholderTextColor={tokens.colors.textDim}
                      value={query}
                      onChangeText={setQuery}
                      style={styles.search}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
                      {[
                        { k: 'oldest', label: 'Oldest' },
                        { k: 'newest', label: 'Newest' },
                        { k: 'amount_desc', label: 'Amount Decr' },
                        { k: 'amount_asc', label: 'Amount Incr' },
                      ].map(opt => (
                        <TouchableOpacity key={opt.k} style={[styles.sortChip, sortBy === opt.k && styles.sortChipActive]} onPress={() => setSortBy(opt.k)}>
                          <Text style={[styles.sortChipText, sortBy === opt.k && styles.sortChipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </Card>
                </>
              )}
              contentContainerStyle={{ paddingBottom: 240 + bottomInset + EXTRA_FLOATING_PADDING }}
              style={{ flex: 1 }}
            />
            {/* Block UI and scrolling when location is missing and an error was encountered */}
            {(!location && locationError) && (
              <View style={styles.locationBlockModalTransparent} pointerEvents="auto">
                <View style={styles.locationBlockBox}>
                  <Text style={styles.locationBlockTitle}>Location Required</Text>
                  <Text style={styles.locationBlockMsg}>{locationErrorMsg || 'Location is required to submit payment. Please enable location services and grant permission.'}</Text>
                  <TouchableOpacity style={styles.locationBlockBtn} onPress={fetchLocation} disabled={locationLoading}>
                    {locationLoading ? (
                      <ActivityIndicator size="small" color="#000" style={{ marginVertical: 2 }} />
                    ) : (
                      <Text style={styles.locationBlockBtnText}>Enable Location</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View
              pointerEvents="box-none"
              style={[
                styles.floatingWrap,
                styles.floatingShadow,
                { bottom: EXTRA_FLOATING_PADDING + bottomInset },
              ]}
            >
              <Card style={styles.floatingCard}>
                <TextInput
                  placeholder="Comment (optional)"
                  placeholderTextColor={tokens.colors.textDim}
                  value={comment}
                  onChangeText={setComment}
                  style={styles.comment}
                />
                <TouchableOpacity disabled={!canSubmit || submitting} style={[styles.submit, (!canSubmit || submitting) && { opacity: 0.6 }]} onPress={submit}>
                  <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Payment'}</Text>
                </TouchableOpacity>
              </Card>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="date"
        onConfirm={(d) => { setPromiseDate(d); setPickerVisible(false); }}
        onCancel={() => setPickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  locationBlockModalTransparent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 99, justifyContent: 'center', alignItems: 'center' },
  locationBlockBox: {
    backgroundColor: tokens.colors.card,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '80%',
    maxWidth: 340,
    borderWidth: 2,
    borderColor: tokens.colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  locationBlockTitle: { fontSize: 20, fontWeight: '800', color: tokens.colors.accent, marginBottom: 14, letterSpacing: 0.5 },
  locationBlockMsg: { fontSize: 15, color: tokens.colors.text, textAlign: 'center', marginBottom: 22, lineHeight: 22 },
  locationBlockBtn: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 38,
    marginTop: 10,
    shadowColor: tokens.colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  locationBlockBtnText: { color: '#000', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  bill: { marginBottom: 10, padding: 12 },
  billSelected: { borderColor: tokens.colors.accent, borderWidth: 1 },
  billNumber: { fontWeight: '800', color: tokens.colors.text },
  outstanding: { fontWeight: '800', color: tokens.colors.accent },
  dateRow: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  dateText: { color: tokens.colors.textSubtle, fontWeight: '700' },
  selText: { marginTop: 6, color: tokens.colors.textSubtle, fontWeight: '700' },
  remLabel: { fontSize: 11, color: tokens.colors.textDim, fontWeight: '700' },
  remValue: { fontSize: 18, fontWeight: '900', color: tokens.colors.text },
  promiseBtn: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  promiseBtnText: { color: tokens.colors.text, fontWeight: '800' },
  search: { marginTop: 8, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.colors.text },
  sortRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border },
  sortChipActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  sortChipText: { fontSize: 12, fontWeight: '700', color: tokens.colors.textSubtle },
  sortChipTextActive: { color: '#000' },
  // removed filter toggle styles
  comment: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.colors.text, marginTop: 0 },
  submit: { marginTop: 12, backgroundColor: tokens.colors.accent, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#000', fontWeight: '800', fontSize: 16 },
  floatingWrap: { position: 'absolute', left: 12, right: 12, zIndex: 20 },
  floatingCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.cardAlt },
  floatingShadow: { shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 12 },
  promiseOverdue: { color: tokens.colors.danger },
  promiseUpcoming: { color: (tokens.colors.warning || '#f5b100') },
});
