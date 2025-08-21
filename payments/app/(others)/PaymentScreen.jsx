import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Picker } from '@react-native-picker/picker';

const paymentMethods = ["Cash", "UPI", "Cheque", "Bank Transfer"];

export default function CollectPaymentScreen() {
  const { company_code } = useLocalSearchParams();
  const router = useRouter();

  const [collectedAt, setCollectedAt] = useState(new Date());
  const [nextPromiseDate, setNextPromiseDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [amountCollected, setAmountCollected] = useState("");
  const [comments, setComments] = useState("");

  // Bill allocations: array of { bill_id (string input), amount (string input) }
  const [billAllocations, setBillAllocations] = useState([{ bill_id: "", amount: "" }]);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);

  const [location, setLocation] = useState(null);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date) => {
    setNextPromiseDate(date);
    hideDatePicker();
  };

  const fetchLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  const addAnotherPayment = () => {
    setBillAllocations([...billAllocations, { bill_id: "", amount: "" }]);
  };

  const updateBillAllocation = (index, field, value) => {
    const updated = billAllocations.map((item, idx) => {
      if (idx === index) return { ...item, [field]: value };
      return item;
    });
    setBillAllocations(updated);
  };

  const handleSubmit = () => {
    if (!amountCollected || isNaN(Number(amountCollected))) {
      Alert.alert("Invalid Input", "Please enter a valid amount collected.");
      return;
    }
    for (const alloc of billAllocations) {
      if (!alloc.bill_id.trim() || !alloc.amount.trim() || isNaN(Number(alloc.amount))) {
        Alert.alert("Invalid Bill Allocation", "Please enter valid bill IDs and amounts for all allocations.");
        return;
      }
    }

    const payload = {
      company_code,
      collected_at: collectedAt.toISOString(),
      amount_collected: Number(amountCollected),
      method: paymentMethod,
      exec_lat: location?.latitude || null,
      exec_lng: location?.longitude || null,
      comments,
      next_promise_date: nextPromiseDate ? nextPromiseDate.toISOString().split("T")[0] : null,
      bill_allocations: billAllocations.map(b => ({ bill_id: Number(b.bill_id), amount: Number(b.amount) })),
      exec_location_verified: null, // removed
    };

    console.log("Submitting payment:", payload);

    Alert.alert("Success", "Payment submitted successfully!");
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Collect Payment</Text>

      {/* Collected At */}
      <Text style={styles.label}>Collected At</Text>
      <TextInput
        style={[styles.input, styles.noBgInput]}
        value={collectedAt.toLocaleString()}
        editable={false}
      />

      {/* Amount Collected */}
      <Text style={styles.label}>Amount Collected</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amountCollected}
        placeholder="Enter amount collected"
        onChangeText={setAmountCollected}
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
        >
          {paymentMethods.map((m) => (
            <Picker.Item key={m} label={m} value={m} />
          ))}
        </Picker>
      </View>

      {/* Next Promise Date */}
      <Text style={styles.label}>Next Promise Date</Text>
      <TouchableOpacity onPress={showDatePicker} style={[styles.input, styles.datePicker]}>
        <Text>{nextPromiseDate ? nextPromiseDate.toDateString() : "Select date"}</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        minimumDate={new Date()}
      />

      {/* Bill Allocations */}
      <Text style={[styles.label, { marginTop: 16 }]}>Bill Allocations</Text>
      {billAllocations.map((alloc, idx) => (
        <View key={idx} style={styles.billAllocRow}>
          <TextInput
            style={[styles.input, styles.billAllocInput]}
            placeholder="Bill ID"
            keyboardType="numeric"
            value={alloc.bill_id}
            onChangeText={(val) => updateBillAllocation(idx, "bill_id", val)}
          />
          <TextInput
            style={[styles.input, styles.billAllocInput]}
            placeholder="Amount"
            keyboardType="numeric"
            value={alloc.amount}
            onChangeText={(val) => updateBillAllocation(idx, "amount", val)}
          />
        </View>
      ))}
      <TouchableOpacity style={styles.addButton} onPress={addAnotherPayment}>
        <Text style={styles.addButtonText}>+ Add Another Payment</Text>
      </TouchableOpacity>

      {/* Comments */}
      <Text style={styles.label}>Comments</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: "top" }]}
        multiline
        placeholder="Enter comments"
        value={comments}
        onChangeText={setComments}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Submit Payment</Text>
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
  noBgInput: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
    borderWidth: 1,
    borderColor: "#b2d9e8",
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
  billAllocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  billAllocInput: {
    width: "48%",
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
  submitButton: {
    backgroundColor: "#2266f1",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  }
});
