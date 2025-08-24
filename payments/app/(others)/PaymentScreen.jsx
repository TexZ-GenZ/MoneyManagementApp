import React, { useState, useEffect, useMemo } from 'react';
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
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Picker } from '@react-native-picker/picker';
import { StorageService } from "../../src/services/storageService";
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI;
const paymentMethods = ["Cash", "UPI", "Cheque", "Bank Transfer"];

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function CollectPaymentScreen() {
  const { company_code, bill_id, bill_number, bill_amount } = useLocalSearchParams();
  const router = useRouter();

  const [collectedAt, setCollectedAt] = useState(new Date());
  const [nextPromiseDate, setNextPromiseDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isNextPromiseDatePickerVisible, setNextPromiseDatePickerVisibility] = useState(false);

  const [amountCollected, setAmountCollected] = useState('');
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bill allocations - start with one empty allocation
  const [billAllocations, setBillAllocations] = useState([{ bill_id: bill_id ? Number(bill_id) : 1, amount: '' }]);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);

  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(false);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date) => {
    setCollectedAt(date);
    hideDatePicker();
  };

  const showNextPromiseDatePicker = () => setNextPromiseDatePickerVisibility(true);
  const hideNextPromiseDatePicker = () => setNextPromiseDatePickerVisibility(false);
  const handleConfirmNextPromiseDate = (date) => {
    setNextPromiseDate(date);
    hideNextPromiseDatePicker();
  };

  const fetchLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // Permission denied: we'll proceed without blocking submission; just record no coords
        setLocationError(true);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });
      setLocation(loc.coords);
      setLocationError(false);
    } catch (error) {
      console.error("Error getting location:", error);
      setLocationError(true);
      Alert.alert("Location Error", "Unable to get your current location. Please ensure GPS is enabled.");
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  const addAnotherAllocation = () => {
    const nextBillId = (Math.max(...billAllocations.map(b => b.bill_id)) || 0) + 1;
    setBillAllocations(prev => [...prev, { bill_id: nextBillId, amount: '' }]);
  };

  const removeBillAllocation = (index) => {
    if (billAllocations.length > 1) {
      const updated = billAllocations.filter((_, idx) => idx !== index);
      setBillAllocations(updated);

      // Recalculate total amount
      const totalAmount = updated.reduce((sum, alloc) => {
        const amount = parseFloat(alloc.amount) || 0;
        return sum + amount;
      }, 0);
      setAmountCollected(totalAmount > 0 ? totalAmount.toString() : "");
    }
  };

  const updateBillAllocation = (index, field, value) => {
    const updated = billAllocations.map((item, idx) => {
      if (idx === index) return { ...item, [field]: value };
      return item;
    });
    setBillAllocations(updated);

    // Auto-calculate total amount collected when amount changes
    if (field === 'amount') {
      const totalAmount = updated.reduce((sum, alloc) => {
        const amount = parseFloat(alloc.amount) || 0;
        return sum + amount;
      }, 0);
      setAmountCollected(totalAmount > 0 ? totalAmount.toString() : "");
    }
  };

  const validateInputs = () => {
    if (!amountCollected || isNaN(Number(amountCollected)) || Number(amountCollected) <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid amount collected.");
      return false;
    }

    for (const [index, alloc] of billAllocations.entries()) {
      if (!alloc.amount.toString().trim() || isNaN(Number(alloc.amount)) || Number(alloc.amount) <= 0) {
        Alert.alert("Invalid Bill Allocation", `Please enter a valid amount for payment ${index + 1}.`);
        return false;
      }
    }

    // Check if total allocation amounts match collected amount
    const totalAllocated = billAllocations.reduce((sum, alloc) => sum + Number(alloc.amount || 0), 0);
    const collectedAmount = Number(amountCollected);

    if (Math.abs(totalAllocated - collectedAmount) > 0.01) { // Allow small floating point differences
      Alert.alert(
        "Amount Mismatch",
        `Total allocated amount (₹${totalAllocated.toFixed(2)}) doesn't match collected amount (₹${collectedAmount.toFixed(2)}).`
      );
      return false;
    }

    return true;
  };

  const submitPayment = async () => {
    if (!validateInputs()) return;

    // Location is now required
    if (!location || !location.latitude || !location.longitude) {
      Alert.alert(
        "Location Required",
        "Location must be captured to submit payment.",
        [
          {
            text: "Retry",
            onPress: async () => {
              await fetchLocation();
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    setSubmitting(true);

    try {
      const token = await StorageService.getToken();
      const idempotencyKey = generateUUID();

      const payload = {
        company_code,
        collected_at: collectedAt.toISOString(),
        amount_collected: Number(amountCollected),
        method: paymentMethod.toLowerCase(),
        comments: comments.trim() || undefined,
        next_promise_date: nextPromiseDate ? nextPromiseDate.toISOString().split("T")[0] : undefined,
        bill_allocations: billAllocations.map(b => ({
          bill_id: b.bill_id,
          amount: Number(b.amount)
        })),
        exec_lat: location.latitude,
        exec_lng: location.longitude
      };

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
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      Alert.alert(
        "Success",
        "Payment submitted successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            }
          }
        ]
      );

    } catch (error) {
      Alert.alert(
        "Submission Failed",
        "An error occurred during this operation.",
        [
          { text: "Retry", onPress: submitPayment },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const totalAllocated = useMemo(() => billAllocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0), [billAllocations]);

  return (
    <Screen title="Collect Payment" subtitle={company_code || ''}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {(company_code || bill_number) && (
            <Card style={styles.cardSection}>
              {company_code && <InfoRow label="Company" value={company_code} />}
              {bill_number && <InfoRow label="Bill" value={bill_number} />}
              {bill_amount && <InfoRow label="Bill Amount" value={`₹${bill_amount}`} />}
            </Card>
          )}

          <Card style={styles.cardSection}>
            <SectionHeader title="Collection" />
            <FieldLabel label="Collected At" />
            <TouchableOpacity onPress={showDatePicker} style={styles.fieldBtn}>
              <Text style={styles.fieldBtnText}>{formatDateTime(collectedAt)}</Text>
            </TouchableOpacity>
            <DateTimePickerModal isVisible={isDatePickerVisible} mode="datetime" onConfirm={handleConfirmDate} onCancel={hideDatePicker} maximumDate={new Date()} />

            <FieldLabel label="Amount Collected (₹)" />
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={amountCollected}
              placeholder="0.00"
              placeholderTextColor={tokens.colors.textFaint}
              onChangeText={setAmountCollected}
              editable={!submitting}
            />

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

            <FieldLabel label="Next Promise Date (Optional)" />
            <TouchableOpacity onPress={showNextPromiseDatePicker} style={styles.fieldBtn} disabled={submitting}>
              <Text style={styles.fieldBtnText}>{nextPromiseDate ? nextPromiseDate.toDateString() : 'Select date'}</Text>
            </TouchableOpacity>
            <DateTimePickerModal isVisible={isNextPromiseDatePickerVisible} mode="date" minimumDate={new Date()} onConfirm={handleConfirmNextPromiseDate} onCancel={hideNextPromiseDatePicker} />
          </Card>

          <Card style={styles.cardSection}>
            <SectionHeader title="Allocations" right={
              <Text style={styles.allocTotal}>Total: {totalAllocated.toFixed(2)}</Text>
            } />
            {billAllocations.map((alloc, idx) => (
              <View key={idx} style={styles.allocRow}>
                <View style={styles.allocBadge}><Text style={styles.allocBadgeText}>#{alloc.bill_id}</Text></View>
                <TextInput
                  style={[styles.textInput, styles.allocInput]}
                  placeholder="Amount"
                  placeholderTextColor={tokens.colors.textFaint}
                  keyboardType="numeric"
                  value={alloc.amount.toString()}
                  onChangeText={(val) => updateBillAllocation(idx, 'amount', val)}
                  editable={!submitting}
                />
                {billAllocations.length > 1 && (
                  <TouchableOpacity onPress={() => removeBillAllocation(idx)} style={styles.removeAllocBtn} disabled={submitting}>
                    <Text style={styles.removeAllocBtnText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addAllocBtn} onPress={addAnotherAllocation} disabled={submitting}>
              <Text style={styles.addAllocBtnText}>+ Add Allocation</Text>
            </TouchableOpacity>
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
            />
          </Card>

          <Card style={styles.cardSection}>
            <SectionHeader title="Location" />
            <View style={styles.locationRow}>
              {location ? (
                <Text style={styles.locationValue}>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>
              ) : (
                <Text style={styles.locationPlaceholder}>Not captured</Text>
              )}
              <TouchableOpacity onPress={fetchLocation} style={styles.captureBtn} disabled={submitting}>
                <Text style={styles.captureBtnText}>{location ? 'Refresh' : 'Capture'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.locationHint}>Coordinates stored for reference only. They appear as a map link in bill payments.</Text>
          </Card>
        </ScrollView>
        <View style={styles.submitBar}>
          <TouchableOpacity style={[styles.submitBtn, submitting && styles.disabledBtn]} disabled={submitting} onPress={submitPayment}>
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Submit Payment</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardSection: { marginBottom: 16, padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  allocTotal: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600' },
  fieldLabel: { color: tokens.colors.textDim, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  fieldBtn: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 14 },
  fieldBtnText: { color: tokens.colors.text, fontSize: 14, fontWeight: '600' },
  textInput: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border, fontWeight: '600', marginBottom: 14 },
  pickerShell: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 14 },
  picker: { color: tokens.colors.text, width: '100%' },
  allocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  allocBadge: { backgroundColor: tokens.colors.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginRight: 10 },
  allocBadgeText: { color: '#000', fontSize: 12, fontWeight: '700' },
  allocInput: { flex: 1, marginBottom: 0, marginRight: 10 },
  removeAllocBtn: { backgroundColor: tokens.colors.danger, width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  removeAllocBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 20 },
  addAllocBtn: { backgroundColor: tokens.colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addAllocBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  multiline: { height: 110, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  locationValue: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  locationPlaceholder: { color: tokens.colors.textDim, fontSize: 13 },
  captureBtn: { backgroundColor: tokens.colors.accent, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  captureBtnText: { color: '#000', fontWeight: '700', fontSize: 12 },
  locationHint: { color: tokens.colors.textFaint, fontSize: 11, marginTop: 10, lineHeight: 14 },
  submitBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: tokens.colors.screen },
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