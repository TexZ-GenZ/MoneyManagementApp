import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { StorageService } from "../../src/services/storageService";
import { useRouter } from "expo-router";

export default function AddUserScreen() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("executive");

  const [error, setError] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    const header = {
      ...(await StorageService.getAuthHeader()),
      "Content-Type": "application/json"
    };

    try {
      const data = {
        username: name,
        mobile: contact,
        password: password,
        role: role,
        area: ""
      };
      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/users`, {
        method: "POST",
        headers: header,
        body: JSON.stringify(data)
      });

      const resData = await res.json();

      if (!res.ok) {
        // Handle error -> show modal
        setError(resData?.message || "Something went wrong!");
        setIsModalVisible(true);
      } else {
        // On success -> navigate to Home
        router.back()
      }

    } catch (error) {
      console.error("Error adding user:", error);
      setError("Network error. Please try again!");
      setIsModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Add User</Text>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter username"
        value={name}
        onChangeText={setName}
      />

      {/* Phone/Email */}
      <Text style={styles.label}>Phone / Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter phone"
        keyboardType="phone-pad"
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
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Add</Text>
      </TouchableOpacity>

      {/* Error Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{error}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#111",
  },
  modalButton: {
    backgroundColor: "#4f46e5",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
