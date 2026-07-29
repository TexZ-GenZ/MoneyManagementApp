import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Linking from 'expo-linking';
import DateTimePickerModal from "react-native-modal-datetime-picker"; // still used for next promise only
import { Picker } from '@react-native-picker/picker';
import { StorageService } from "../../src/services/storageService";
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { API_BASE_URL } from '../../src/utils/constants';
import { emitPaymentUpdate } from '../../src/events/paymentEvents';
import { formatDate, formatDateTime } from '../../src/ui/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const paymentMethods = ["Cash", "UPI", "Cheque", "Bank Transfer", "Goods Return"];

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function CollectPaymentScreen() {
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);
  const { company_code, bill_id, bill_number, bill_amount } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [collectedAt, setCollectedAt] = useState(new Date());
  const [isCollectedAtPickerVisible, setCollectedAtPickerVisibility] = useState(false);
  const [nextPromiseDate, setNextPromiseDate] = useState(null);
  const [isNextPromiseDatePickerVisible, setNextPromiseDatePickerVisibility] = useState(false);

  const [amountCollected, setAmountCollected] = useState('');
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isFullPayment, setIsFullPayment] = useState(true);
  const [billData, setBillData] = useState(null); // fetched bill for remaining calc
  const [billRemaining, setBillRemaining] = useState(null);
  const [pendingReserved, setPendingReserved] = useState(0); // sum of pending (not yet in amount_paid) amounts

  // Helper to floor a number to 2 decimal places
  const floor2 = (n) => Math.floor((n + Number.EPSILON) * 100) / 100;

  // Sanitize & floor to 2 decimal places for partial payment input (fully editable)
  const handlePartialAmountChange = (raw) => {
    // Allow only digits and a single dot
    let cleaned = raw.replace(/[^0-9.]/g, '');
    // Only one dot allowed
    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    // Limit to two decimal digits (truncate, not round up)
    if (firstDot !== -1) {
      const intPart = cleaned.slice(0, firstDot);
      let decPart = cleaned.slice(firstDot + 1, firstDot + 3); // at most 2 digits
      cleaned = decPart.length ? `${intPart}.${decPart}` : intPart + '.';
    }
    // Allow empty string for full editability
    setAmountCollected(cleaned);
  };
  // Fetch bill details to compute remaining outstanding
  useEffect(() => {
    (async () => {
      if (!bill_id) return;
      try {
        const token = await StorageService.getToken();
        const r = await fetch(`${API_BASE_URL}/bills/${bill_id}`, { headers: { 'Authorization': token ? `Bearer ${token.access_token}` : '' } });
        if (r.ok) {
          const data = await r.json();
          setBillData(data);
          const total = parseFloat(data.amount) || 0;
          const paid = parseFloat(data.amount_paid) || 0;
          // We'll fetch pending payments separately to avoid race; provisional remaining (no pending subtraction yet)
          const remaining = Math.max(total - paid, 0);
          setBillRemaining(remaining);
        }
      } catch (_) { }
    })();
  }, [bill_id]);

  // Fetch bill payments to compute reserved pending amounts (submitted / accountant_approved)
  useEffect(() => {
    (async () => {
      if (!bill_id) return;
      try {
        const token = await StorageService.getToken();
        const r = await fetch(`${API_BASE_URL}/bills/${bill_id}/payments`, { headers: { 'Authorization': token ? `Bearer ${token.access_token}` : '' } });
        if (r.ok) {
          const payload = await r.json();
          const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload) ? payload : [];
          const pendingSum = items.reduce((sum, p) => {
            const st = (p.payment_status || p.status || '').toLowerCase();
            if (st === 'submitted' || st === 'accountant_approved') {
              return sum + (parseFloat(p.amount) || 0);
            }
            return sum;
          }, 0);
          setPendingReserved(pendingSum);
        }
      } catch (_) { }
    })();
  }, [bill_id]);

  // Recompute remaining when pendingReserved or billData change
  useEffect(() => {
    if (!billData) return;
    const total = parseFloat(billData.amount) || 0;
    const paid = parseFloat(billData.amount_paid) || 0;
    const remaining = Math.max(total - paid - pendingReserved, 0);
    setBillRemaining(remaining);
  }, [billData, pendingReserved]);
  const [companyName, setCompanyName] = useState(null);
  const [companyCreditDate, setCompanyCreditDate] = useState(null);
  const [billPromiseDate, setBillPromiseDate] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);

  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const showNextPromiseDatePicker = () => setNextPromiseDatePickerVisibility(true);
  const hideNextPromiseDatePicker = () => setNextPromiseDatePickerVisibility(false);
  const handleConfirmNextPromiseDate = (date) => {
    setNextPromiseDate(date);
    hideNextPromiseDatePicker();
  };

  const [locationErrorMsg, setLocationErrorMsg] = useState("");
  const fetchLocation = async () => {
    setLocation(null); // reset so modal logic can re-open on subsequent attempts
    setLocationLoading(true);
    try {
      let { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(true);
        // If the system won't show the dialog again, guide user to system settings
        if (canAskAgain === false) {
          setLocationErrorMsg("Location permission permanently denied. Open Settings to allow location.");
        } else {
          setLocationErrorMsg("Location permission denied. Please enable location to proceed.");
        }
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 10000 });
        setLocation(loc.coords);
        setLocationError(false);
        setLocationErrorMsg("");
      } catch (error) {
        setLocationError(true);
        setLocationErrorMsg("Unable to get your current location. Please ensure GPS is enabled and try again.");
      }
    } catch (error) {
      setLocationError(true);
      setLocationErrorMsg("Location permission denied. Please enable location to proceed.");
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // Fetch company details if available
  useEffect(() => {
    (async () => {
      if (!company_code) return;
      try {
        const token = await StorageService.getToken();
        const r = await fetch(`${API_BASE_URL}/companies/${company_code}`, { headers: { 'Authorization': token ? `Bearer ${token.access_token}` : '' } });
        if (r.ok) {
          const data = await r.json();
          setCompanyName(data.name || null);
          setCompanyCreditDate(data.credit_date ? new Date(data.credit_date) : null);
          // Note: promise now tracked per-bill; keep credit_date only from company
        }
      } catch (_) { }
    })();
  }, [company_code]);

  // Fetch bill to get bill-level promise_date
  useEffect(() => {
    (async () => {
      if (!bill_id) return;
      try {
        const token = await StorageService.getToken();
        const r = await fetch(`${API_BASE_URL}/bills/${bill_id}`, { headers: { 'Authorization': token ? `Bearer ${token.access_token}` : '' } });
        if (r.ok) {
          const data = await r.json();
          setBillPromiseDate(data.promise_date ? new Date(data.promise_date) : null);
        }
      } catch (_) { }
    })();
  }, [bill_id]);

  // Collected-at handlers for the date picker
  const showCollectedAtPicker = () => setCollectedAtPickerVisibility(true);
  const hideCollectedAtPicker = () => setCollectedAtPickerVisibility(false);
  const handleConfirmCollectedAt = (date) => {
    // Preserve current time, only change date
    const merged = new Date(date);
    merged.setHours(
      collectedAt.getHours(),
      collectedAt.getMinutes(),
      collectedAt.getSeconds()
    );
    setCollectedAt(merged);
    hideCollectedAtPicker();
  };

  const validateInputs = () => {
    if (!amountCollected || isNaN(Number(amountCollected)) || Number(amountCollected) <= 0) {
      Alert.alert('Invalid Input', 'Enter a valid collected amount.');
      return false;
    }
    // Minimum amount validation: must be at least 100 (shows as ₹1.00 after division by 100)
    if (Number(amountCollected) < 100) {
      Alert.alert('Amount Too Small', 'Minimum payment amount is ₹1.00 (enter 100 or more).');
      return false;
    }
    if (!isFullPayment && !nextPromiseDate) {
      Alert.alert('Missing Next Promise', 'Next promise date is required for partial payments.');
      return false;
    }
    // Business rule: next_promise_date must not be earlier than credit_date or existing bill promise_date
    if (!isFullPayment && nextPromiseDate) {
      const minDate = billPromiseDate || companyCreditDate; // bill promise takes precedence when present
      if (minDate) {
        const np = new Date(nextPromiseDate); np.setHours(0, 0, 0, 0);
        const md = new Date(minDate); md.setHours(0, 0, 0, 0);
        if (np < md) {
          const msg = billPromiseDate
            ? `Next promise date cannot be earlier than current promise date (${formatDate(billPromiseDate)}).`
            : `Next promise date cannot be earlier than credit date (${formatDate(companyCreditDate)}).`;
          Alert.alert('Invalid Next Promise', msg);
          return false;
        }
      }
    }
    if (!location) {
      Alert.alert('Location Needed', 'Enable and capture location before submitting.');
      return false;
    }
    return true;
  };

  const submitPayment = async () => {
    if (!validateInputs()) return;

    setSubmitting(true);

    try {
      const token = await StorageService.getToken();
      const idempotencyKey = generateUUID();

      const payload = {
        company_code,
        collected_at: collectedAt.toISOString(),
        amount_collected: Number(amountCollected),
        method: paymentMethod === "Goods Return" ? "goods_return" : paymentMethod.toLowerCase(),
        comments: comments.trim() || undefined,
        next_promise_date: (!isFullPayment && nextPromiseDate) ? nextPromiseDate.toISOString().split('T')[0] : undefined
      };

      // Allocate up to the bill's remaining amount; extra collection is surplus.
      if (bill_id) {
        const collected = Number(amountCollected);
        const allocatable = billRemaining != null ? Math.min(collected, Math.max(billRemaining, 0)) : collected;
        payload.bill_allocations = allocatable > 0
          ? [{ bill_id: Number(bill_id), amount: floor2(allocatable) }]
          : [];
      }

      // Add coordinates if available
      if (location?.latitude && location?.longitude) {
        payload.exec_lat = location.latitude;
        payload.exec_lng = location.longitude;
      }

      const response = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.access_token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const serverDetail = errorData?.detail || errorData?.message;
        throw new Error(serverDetail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      Alert.alert(
        "Success",
        "Payment submitted successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              try {
                // Notify lists/detail screens to refresh immediately
                emitPaymentUpdate({ type: 'submitted', bill_id: bill_id ? Number(bill_id) : undefined });
              } catch (_) { }
              router.back();
            }
          }
        ]
      );

    } catch (error) {
      Alert.alert(
        "Submission Failed",
        error.message || "Failed to submit payment. Please check your connection and try again.",
        [
          { text: "Retry", onPress: submitPayment },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Use shared formatDateTime util for IST, no seconds


  // Auto set amount on payment type toggle
  useEffect(() => {
    if (isFullPayment && !submitting) {
      // Full payment: set to max
      const useRemaining = billRemaining != null ? billRemaining : (bill_amount ? Number(bill_amount) : null);
      if (useRemaining != null) {
        const floored = floor2(useRemaining);
        setAmountCollected(floored.toFixed(2));
      }
    } else if (!isFullPayment && !submitting) {
      // Partial: set to 1 less than max, or 1 if not possible
      const useRemaining = billRemaining != null ? billRemaining : (bill_amount ? Number(bill_amount) : null);
      let partial = 1;
      if (useRemaining != null && useRemaining > 1) {
        partial = floor2(useRemaining - 1);
        if (partial < 1) partial = 1;
      }
      setAmountCollected(partial.toFixed(2));
    }
  }, [isFullPayment, bill_amount, billRemaining, submitting]);

  const locationModalOpen = !location && locationError;
  return (
    <Screen title="Collect Payment" subtitle={company_code || ''}>
      {/* Blocking modal for location permission denied */}
      {locationModalOpen && (
        <View style={styles.locationBlockModalTransparent} pointerEvents="auto">
          <View style={styles.locationBlockBox}>
            <Text style={styles.locationBlockTitle}>Location Required</Text>
            <Text style={styles.locationBlockMsg}>{locationErrorMsg || "Location is required to collect payment. Please enable location services and grant permission."}</Text>
            <TouchableOpacity style={styles.locationBlockBtn} onPress={async () => {
                try {
                  const { canAskAgain } = await Location.getForegroundPermissionsAsync();
                  if (canAskAgain === false) {
                    // Deep link to system settings when permission is permanently denied
                    Linking.openSettings?.();
                  } else {
                    fetchLocation();
                  }
                } catch (_) {
                  fetchLocation();
                }
              }} disabled={locationLoading}>
              {locationLoading ? (
                <ActivityIndicator size="small" color="#000" style={{ marginVertical: 2 }} />
              ) : (
                <Text style={styles.locationBlockBtnText}>Enable Location</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 95} // tweak so last field clears keyboard
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          scrollEnabled={!locationModalOpen}
          pointerEvents={locationModalOpen ? 'none' : 'auto'}
          keyboardShouldPersistTaps="handled"
        >
          {(company_code || bill_number) && (
            <Card style={styles.cardSection}>
              {companyName && <InfoRow label="Company" value={companyName} />}
              {company_code && <InfoRow label="Company Code" value={company_code} />}
              {bill_id && <InfoRow label="Bill ID" value={bill_id} />}
              {bill_number && <InfoRow label="Bill Number" value={bill_number} />}
              {bill_amount && <InfoRow label="Bill Amount" value={`₹${bill_amount}`} />}
            </Card>
          )}

          <Card style={styles.cardSection}>
            <SectionHeader title="Collection" />
            <FieldLabel label="Collected At" />
            <TouchableOpacity onPress={showCollectedAtPicker} style={styles.fieldBtn} disabled={submitting}>
              <Text style={styles.fieldBtnText}>{formatDateTime(collectedAt)}</Text>
            </TouchableOpacity>

            <FieldLabel label="Payment Type" />
            <View style={styles.toggleRow}>
              <TouchableOpacity disabled={submitting} onPress={() => setIsFullPayment(true)} style={[styles.toggleBtn, isFullPayment && styles.toggleBtnActive]}>
                <Text style={[styles.toggleBtnText, isFullPayment && styles.toggleBtnTextActive]}>Full</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={submitting} onPress={() => setIsFullPayment(false)} style={[styles.toggleBtn, !isFullPayment && styles.toggleBtnActive]}>
                <Text style={[styles.toggleBtnText, !isFullPayment && styles.toggleBtnTextActive]}>Partial</Text>
              </TouchableOpacity>
            </View>

            <FieldLabel label={isFullPayment ? 'Amount (Full Payment)' : 'Amount Collected (₹)'} />
            <Text style={styles.helpText}>💡 Enter amounts in new format: ₹100 = ₹1.00, ₹12784 = ₹127.84</Text>
            {isFullPayment && (
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={amountCollected}
                placeholder="0.00"
                placeholderTextColor={tokens.colors.textFaint}
                onChangeText={handlePartialAmountChange}
                editable={!submitting}
                maxLength={12}
              />
            )}
            {!isFullPayment && (
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={amountCollected}
                placeholder="0.00"
                placeholderTextColor={tokens.colors.textFaint}
                onChangeText={handlePartialAmountChange}
                editable={!submitting}
                maxLength={12}
              />
            )}
            <Text style={styles.helpText}>
              {billRemaining != null ? `Remaining to allocate: ${billRemaining.toFixed(2)}${pendingReserved ? ' after pending approvals' : ''}. Extra will be recorded as surplus.` : 'Extra collection above bill balance will be recorded as surplus.'}
            </Text>

            <FieldLabel label="Payment Method" />
            <View style={styles.pickerShell}>
              <Picker
                selectedValue={paymentMethod}
                onValueChange={(itemValue) => setPaymentMethod(itemValue)}
                mode="dropdown"
                enabled={!submitting}
                style={styles.picker}
              >
                {paymentMethods.map(m => <Picker.Item key={m} label={m} value={m} />)}
              </Picker>
            </View>

            {!isFullPayment && (
              <>
                <FieldLabel label="Next Promise Date (Required for Partial)" />
                <TouchableOpacity onPress={showNextPromiseDatePicker} style={styles.fieldBtn} disabled={submitting}>
                  <Text style={styles.fieldBtnText}>{nextPromiseDate ? formatDate(nextPromiseDate) : 'Select date'}</Text>
                </TouchableOpacity>
                <DateTimePickerModal isVisible={isNextPromiseDatePickerVisible} mode="date" minimumDate={new Date()} onConfirm={handleConfirmNextPromiseDate} onCancel={hideNextPromiseDatePicker} />
              <DateTimePickerModal isVisible={isCollectedAtPickerVisible} mode="date" onConfirm={handleConfirmCollectedAt} onCancel={hideCollectedAtPicker} maximumDate={new Date()} />
              </>
            )}
          </Card>

          <Card style={styles.cardSection}>
            <SectionHeader title="Comments" />
            <TextInput
              style={[styles.textInput, styles.multiline]}
              multiline
              placeholder="Optional notes"
              placeholderTextColor={tokens.colors.textFaint}
              value={comments}
              onChangeText={setComments}
              editable={!submitting}
              onFocus={() => {
                if (scrollViewRef.current) {
                  scrollViewRef.current.measure?.((x, y, width, height) => {
                    scrollViewRef.current.scrollTo({ y: height * 0.7, animated: true });
                  });
                }
              }}
            />

          </Card>

          <Card style={styles.cardSection}>
            <SectionHeader title="Location" />
            <View style={styles.locationRow}>
              <View style={[styles.locationStatusPill, location ? styles.locationActive : styles.locationInactive]}>
                <Text style={[styles.locationStatusText, location ? styles.locationStatusTextActive : null]}>{location ? 'Location Active' : 'Location Required'}</Text>
              </View>
              <TouchableOpacity
                onPress={fetchLocation}
                style={[styles.captureBtnSmall, styles.captureBtnPrimary]}
                disabled={submitting || locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#000" style={{ marginVertical: 2 }} />
                ) : (
                  <Text style={styles.captureBtnTextSmall}>{location ? 'Refresh Location' : 'Enable'}</Text>
                )}
              </TouchableOpacity>
            </View>
            {/* Already handled by blocking modal above */}
            {location && <Text style={styles.locationHint}>Location captured (coordinates hidden).</Text>}
          </Card>
        </ScrollView>
        <View style={[styles.submitBar, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity style={[styles.submitBtn, (submitting || !location) && styles.disabledBtn]} disabled={submitting || !location} onPress={submitPayment}>
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Submit Payment</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  cardSection: { marginBottom: 16, padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  allocTotal: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600' },
  fieldLabel: { color: tokens.colors.textDim, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  helpText: { color: tokens.colors.accent, fontSize: 11, fontWeight: '600', marginBottom: 8, fontStyle: 'italic' },
  fieldBtn: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 14 },
  fieldBtnText: { color: tokens.colors.text, fontSize: 14, fontWeight: '600' },
  textInput: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border, fontWeight: '600', marginBottom: 14 },
  pickerShell: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 14 },
  picker: { color: tokens.colors.text, width: '100%' },
  toggleRow: { flexDirection: 'row', marginBottom: 14, backgroundColor: tokens.colors.cardAlt, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: tokens.colors.border },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: tokens.colors.accent },
  toggleBtnText: { color: tokens.colors.textDim, fontWeight: '600', fontSize: 13 },
  toggleBtnTextActive: { color: '#000' },
  multiline: { height: 110, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  locationStatusPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: tokens.colors.border },
  locationActive: { backgroundColor: 'rgba(120,200,120,0.15)', borderColor: 'rgba(120,200,120,0.4)' },
  locationInactive: { backgroundColor: 'rgba(200,80,80,0.12)', borderColor: 'rgba(200,80,80,0.35)' },
  locationStatusText: { fontSize: 12, fontWeight: '600', color: tokens.colors.textDim },
  locationStatusTextActive: { color: tokens.colors.text },
  captureBtn: {
    backgroundColor: tokens.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: 0,
  },
  captureBtnPrimary: {},
  captureBtnText: { color: '#000', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  locationHint: { color: tokens.colors.textFaint, fontSize: 11, marginTop: 10, lineHeight: 14 },
  captureBtnSmall: {
    backgroundColor: tokens.colors.accent,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: 0,
    minWidth: 90,
  },
  captureBtnTextSmall: { color: '#000', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  // Removed custom refresh styles; use captureBtnPrimary and captureBtnText for consistency
  locationRefreshBtnModern: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: tokens.colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    marginLeft: 8,
  },
  locationRefreshBtnTextModern: { color: tokens.colors.accent, fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  locationRefreshBtnIcon: { fontSize: 18, color: tokens.colors.accent, marginRight: 6, fontWeight: '800' },
  submitBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: tokens.colors.bg },
  submitBtn: { backgroundColor: tokens.colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { color: tokens.colors.textDim, fontSize: 12 },
  infoValue: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' }
});

function SectionHeader({ title, right }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

function FieldLabel({ label }) { return <Text style={styles.fieldLabel}>{label}</Text>; }
function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
