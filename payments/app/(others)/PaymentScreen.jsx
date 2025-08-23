import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  ActivityIndicator 
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Picker } from '@react-native-picker/picker';
import { StorageService } from "../../src/services/storageService";

const API_BASE_URL = 'https://moneymanagementapp-production.up.railway.app';
const paymentMethods = ["Cash", "UPI", "Cheque", "Bank Transfer"];

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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

  const [amountCollected, setAmountCollected] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bill allocations - start with one empty allocation
  const [billAllocations, setBillAllocations] = useState([
    { bill_id: 1, amount: "" }
  ]);
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
        setLocationError(true);
        Alert.alert(
          "Location Permission", 
          "Location permission is required to verify your position during payment collection.",
          [{ text: "OK" }]
        );
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

  const addAnotherPayment = () => {
    const nextBillId = Math.max(...billAllocations.map(b => b.bill_id)) + 1;
    setBillAllocations([...billAllocations, { bill_id: nextBillId, amount: "" }]);
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

    if (locationError || !location) {
      Alert.alert(
        "Location Required",
        "Location verification is required. Please enable GPS and try again.",
        [
          { text: "Retry", onPress: fetchLocation },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    setSubmitting(true);

    try {
      const token =  await StorageService.getToken();
      console.log(token.access_token)
      const idempotencyKey = generateUUID();
      
      const payload = {
        company_code,
        collected_at: collectedAt.toISOString(),
        amount_collected: Number(amountCollected),
        method: paymentMethod.toLowerCase(),
        comments: comments.trim() || undefined,
        exec_location_verified: true,
        next_promise_date: nextPromiseDate ? nextPromiseDate.toISOString().split("T")[0] : undefined,
        bill_allocations: billAllocations.map(b => ({
          bill_id: b.bill_id,
          amount: Number(b.amount)
        }))
      };

      // Add location if available
      // if (location) {
      //   payload.exec_lat = location.latitude;
      //   payload.exec_lng = location.longitude;
      // }

      console.log("Submitting payment:", payload);

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
        console.log(errorData)
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Payment submitted successfully:", result);

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
      console.error("Error submitting payment:", error);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Collect Payment</Text>
      
      {company_code && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Company: {company_code}</Text>
          {bill_number && <Text style={styles.infoText}>Bill: {bill_number}</Text>}
        </View>
      )}

      {/* Collected At */}
      <Text style={styles.label}>Collected At</Text>
      <TouchableOpacity onPress={showDatePicker} style={[styles.input, styles.datePicker]}>
        <Text style={styles.dateText}>{formatDateTime(collectedAt)}</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        maximumDate={new Date()}
      />

      {/* Amount Collected */}
      <Text style={styles.label}>Amount Collected (₹)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amountCollected}
        placeholder="Enter amount collected"
        onChangeText={setAmountCollected}
        editable={!submitting}
      />

      {/* Payment Method Dropdown */}
      <Text style={styles.label}>Payment Method</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={paymentMethod}
          onValueChange={(itemValue) => setPaymentMethod(itemValue)}
          mode="dropdown"
          dropdownIconColor="#184977"
          style={styles.picker}
          enabled={!submitting}
        >
          {paymentMethods.map((method) => (
            <Picker.Item key={method} label={method} value={method} />
          ))}
        </Picker>
      </View>

      {/* Next Promise Date */}
      <Text style={styles.label}>Next Promise Date (Optional)</Text>
      <TouchableOpacity 
        onPress={showNextPromiseDatePicker} 
        style={[styles.input, styles.datePicker]}
        disabled={submitting}
      >
        <Text style={styles.dateText}>
          {nextPromiseDate ? nextPromiseDate.toDateString() : "Select date (optional)"}
        </Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isNextPromiseDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmNextPromiseDate}
        onCancel={hideNextPromiseDatePicker}
        minimumDate={new Date()}
      />

      {/* Bill Allocations */}
      <Text style={[styles.label, { marginTop: 16 }]}>Payment Allocations</Text>
      {billAllocations.map((alloc, idx) => (
        <View key={idx} style={styles.billAllocContainer}>
          <View style={styles.billAllocRow}>
            <View style={styles.billIdContainer}>
              <Text style={styles.billIdText}>Payment #{alloc.bill_id}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.billAllocInput]}
              placeholder="Amount (₹)"
              keyboardType="numeric"
              value={alloc.amount.toString()}
              onChangeText={(val) => updateBillAllocation(idx, "amount", val)}
              editable={!submitting}
            />
            {billAllocations.length > 1 && (
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeBillAllocation(idx)}
                disabled={submitting}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      
      <TouchableOpacity 
        style={[styles.addButton, submitting && styles.disabledButton]} 
        onPress={addAnotherPayment}
        disabled={submitting}
      >
        <Text style={styles.addButtonText}>+ Add Another Payment</Text>
      </TouchableOpacity>

      {/* Comments */}
      <Text style={styles.label}>Comments (Optional)</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: "top" }]}
        multiline
        placeholder="Enter any additional comments"
        value={comments}
        onChangeText={setComments}
        editable={!submitting}
      />

      {/* Location Status */}
      <View style={styles.locationStatus}>
        <Text style={styles.locationLabel}>Location Status: </Text>
        <Text style={[styles.locationText, location ? styles.locationSuccess : styles.locationError]}>
          {location ? "✓ Verified" : "⚠ Required"}
        </Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity 
        style={[styles.submitButton, submitting && styles.disabledButton]} 
        onPress={submitPayment}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Payment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafd"
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#184977",
    marginBottom: 20
  },
  infoBox: {
    backgroundColor: "#e6fbfa",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#b2d9e8",
  },
  infoText: {
    fontSize: 14,
    color: "#184977",
    fontWeight: "600",
  },
  label: {
    fontSize: 15,
    color: "#3a5477",
    fontWeight: "600",
    marginBottom: 8
  },
  input: {
    backgroundColor: "#e6fbfa",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    color: "#184977",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#b2d9e8",
    shadowColor: "#bbe5ed",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#b2d9e8",
    borderRadius: 14,
    backgroundColor: "#e6fbfa",
    marginBottom: 12,
  },
  picker: {
    color: "#184977",
    fontWeight: "600",
  },
  datePicker: {
    justifyContent: "center"
  },
  dateText: {
    color: "#184977",
    fontWeight: "600",
  },
  billAllocContainer: {
    marginBottom: 8,
  },
  billAllocRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  billIdContainer: {
    backgroundColor: "#184977",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    minWidth: 80,
    alignItems: "center",
  },
  billIdText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  billAllocInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  removeButton: {
    backgroundColor: "#ff4444",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: "#1f75fe",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  locationStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  locationLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  locationText: {
    fontSize: 14,
    fontWeight: "700",
  },
  locationSuccess: {
    color: "#209653",
  },
  locationError: {
    color: "#d73838",
  },
  submitButton: {
    backgroundColor: "#2266f1",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});