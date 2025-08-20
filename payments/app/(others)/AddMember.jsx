import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";

export default function AddUserScreen() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("executive");

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Add User</Text>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter full name"
        value={name}
        onChangeText={setName}
      />

      {/* Phone/Email */}
      <Text style={styles.label}>Phone / Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter phone or email"
        keyboardType="email-address"
        value={contact}
        onChangeText={setContact}
      />

      {/* Password */}
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* Role Picker */}
      <Text style={styles.label}>Role</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={role}
          onValueChange={(itemValue) => setRole(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Admin" value="admin" />
          <Picker.Item label="Executive" value="executive" />
          <Picker.Item label="Accountant" value="accountant" />
        </Picker>
      </View>

      {/* Submit Button */}
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 16,
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    marginBottom: 24,
  },
  picker: {
    height: 70,
    width: "100%",
  },
  button: {
    backgroundColor: "#4f46e5", // Indigo shade
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
