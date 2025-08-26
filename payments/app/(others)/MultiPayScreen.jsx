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

export default function MultiPayScreen() {
  const { code, name, amount } = useLocalSearchParams();
  const router = useRouter();
  const initialTotal = Math.max(0, Number(amount || 0));
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(initialTotal);
  const [selected, setSelected] = useState({}); // bill_id -> allocated amount
  const [promiseDate, setPromiseDate] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [location, setLocation] = useState(null);
  const [comment, setComment] = useState('');
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('oldest'); // oldest | newest | amount_desc | amount_asc
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch bills
  useEffect(() => {
    (async () => {
      try {
        const tok = await StorageService.getToken();
        const r = await fetch(`${API_BASE_URL}/companies/${code}/bills?status=pending&sort=oldest`, { headers: { 'Authorization': tok ? `Bearer ${tok.access_token}` : '' } });
        const data = await r.json();
        setBills(Array.isArray(data.items) ? data.items : []);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, [code]);

  // Get location once
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 10000 });
        setLocation(loc.coords);
      } catch {}
    })();
  }, []);

  // Recompute remaining from selections
  const recomputeRemaining = () => {
    const totalAlloc = Object.values(selected).reduce((s, v) => s + (Number(v)||0), 0);
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
    let rem = initialTotal - Object.values(selected).reduce((s,v)=>s+Number(v||0),0);
    if (rem <= 0) return; // nothing to upgrade
    const ordered = bills.slice().sort((a,b)=> new Date(a.bill_date) - new Date(b.bill_date));
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

  const canSubmit = remaining === 0 && Object.keys(selected).length > 0 && (!needsPromise() || !!promiseDate);

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
    setSubmitting(true);
    try {
      const tok = await StorageService.getToken();
      const payload = {
        company_code: code,
        collected_at: new Date().toISOString(),
        amount_collected: initialTotal,
        method: method,
        comments: comment || undefined,
        next_promise_date: promiseDate ? promiseDate.toISOString().slice(0,10) : undefined,
        bill_allocations: Object.entries(selected).map(([bill_id, amount]) => ({ bill_id: Number(bill_id), amount: Number(amount) })),
      };
      if (location?.latitude && location?.longitude) {
        payload.exec_lat = location.latitude; payload.exec_lng = location.longitude;
        payload.exec_location_verified = true;
      }
      const r = await fetch(`${API_BASE_URL}/payments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': tok ? `Bearer ${tok.access_token}` : '' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(await r.text());
      await r.json().catch(()=>null);
      Alert.alert('Success', 'Bulk payment submitted');
      emitPaymentUpdate({ type: 'submitted' });
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit bulk payment');
    } finally { setSubmitting(false); }
  };

  const visibleBills = useMemo(() => {
    const norm = (s)=> String(s||'').toLowerCase();
    const filtered = bills.filter(b => {
      if (!query.trim()) return true;
      const q = norm(query.trim());
      return norm(b.bill_number).includes(q);
    });
    const sortKey = (b)=> ({
      oldest: new Date(b.bill_date).getTime(),
      newest: -new Date(b.bill_date).getTime(),
      amount_desc: -(Number(b.amount)-Number(b.amount_paid)),
      amount_asc: (Number(b.amount)-Number(b.amount_paid))
    })[sortBy] ?? new Date(b.bill_date).getTime();
    return filtered.slice().sort((a,b)=> sortKey(a) - sortKey(b));
  }, [bills, query, sortBy]);

  const renderBill = ({ item }) => {
    const out = Math.max(0, Number(item.amount) - Number(item.amount_paid));
    const selAmt = Number(selected[item.id] || 0);
    const selectedFlag = selAmt > 0;
    return (
      <TouchableOpacity onPress={() => toggleBill(item)} activeOpacity={0.8}>
        <Card style={[styles.bill, selectedFlag && styles.billSelected]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.billNumber}>{item.bill_number}</Text>
            <Text style={styles.outstanding}>{formatCurrency(out)}</Text>
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
                    <TouchableOpacity style={styles.filterHeader} onPress={()=> setFiltersOpen(v=>!v)}>
                      <Text style={styles.filterTitle}>Filters</Text>
                      <Text style={styles.filterCaret}>{filtersOpen ? '▾' : '▸'}</Text>
                    </TouchableOpacity>
                    {filtersOpen ? (
                      <>
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
                            <TouchableOpacity key={opt.k} style={[styles.sortChip, sortBy===opt.k && styles.sortChipActive]} onPress={()=> setSortBy(opt.k)}>
                              <Text style={[styles.sortChipText, sortBy===opt.k && styles.sortChipTextActive]}>{opt.label}</Text>
                            </TouchableOpacity>
                          ))}
                          </ScrollView>
                      </>
                    ) : null}
                  </Card>
                </>
              )}
              contentContainerStyle={{ paddingBottom: 100 }}
              style={{ flex: 1 }}
            />
            <Card style={{ padding: 12, marginBottom: 24 }}>
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
          </>
        )}
      </KeyboardAvoidingView>
      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="date"
        onConfirm={(d)=>{ setPromiseDate(d); setPickerVisible(false); }}
        onCancel={()=> setPickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bill: { marginBottom: 10, padding: 12 },
  billSelected: { borderColor: tokens.colors.accent, borderWidth: 1 },
  billNumber: { fontWeight: '800', color: tokens.colors.text },
  outstanding: { fontWeight: '800', color: tokens.colors.accent },
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
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',  },
  filterTitle: { fontWeight: '800', color:tokens.colors.accent},
  filterCaret: { color: tokens.colors.textDim, fontSize: 16, marginLeft: 8 },
  comment: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.colors.text, marginTop: 10 },
  submit: { marginTop: 12, backgroundColor: tokens.colors.accent, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#000', fontWeight: '800' },
});
