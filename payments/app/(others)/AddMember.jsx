import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, SafeAreaView, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { StorageService } from "../../src/services/storageService";
import { useRouter } from "expo-router";
import GridBackground from '../(others)/GridBGComponent';

export default function AddUserScreen() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("executive");

  const [error, setError] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setError("Please enter a username");
      setIsModalVisible(true);
      return;
    }
    if (!contact.trim()) {
      setError("Please enter phone/email");
      setIsModalVisible(true);
      return;
    }
    if (!password.trim()) {
      setError("Please enter a password");
      setIsModalVisible(true);
      return;
    }

    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (roleValue) => {
    switch(roleValue) {
      case 'admin': return 'shield';
      case 'accountant': return 'calculator';
      case 'executive': return 'person';
      default: return 'person';
    }
  };

  const getRoleColor = (roleValue) => {
    switch(roleValue) {
      case 'admin': return '#ff6b6b';
      case 'accountant': return '#4ecdc4';
      case 'executive': return '#c8f14c';
      default: return '#c8f14c';
    }
  };

  return (
    <LinearGradient
      colors={['#000', '#000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <GridBackground />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior="padding">
          {/* Header */}
          <View style={styles.topBar}>
            <Text style={styles.title}>Add User ➕</Text>
            <Text style={styles.subtitle}>Create a new user account</Text>
          </View>

          {/* Form Card */}
          <View style={styles.cardContainer}>
            {/* Name Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#c8f14c" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter username"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Contact Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone / Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#c8f14c" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone or email"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  keyboardType="phone-pad"
                  value={contact}
                  onChangeText={setContact}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#c8f14c" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {/* Role Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleSelector}>
                <View style={styles.roleIconWrapper}>
                  <Ionicons name={getRoleIcon(role)} size={20} color={getRoleColor(role)} />
                </View>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={role}
                    onValueChange={(itemValue) => setRole(itemValue)}
                    style={styles.picker}
                    dropdownIconColor="rgba(255, 255, 255, 0.6)"
                  >
                    <Picker.Item label="Executive" value="executive" color="#fff" />
                    <Picker.Item label="Accountant" value="accountant" color="#fff" />
                    <Picker.Item label="Admin" value="admin" color="#fff" />
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContent}>
                  <Text style={styles.submitButtonText}>Adding User...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="person-add" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Add User</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Error Modal */}
        <Modal
          visible={isModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
                <Text style={styles.modalTitle}>Error</Text>
              </View>
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
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    marginBottom: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9f9f9',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  cardContainer: {
    backgroundColor: '#000',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  roleIconWrapper: {
    marginRight: 12,
  },
  pickerWrapper: {
    flex: 1,
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 30,
  },
  submitButton: {
    backgroundColor: '#c8f14c',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(200, 241, 76, 0.5)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#000',
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#c8f14c',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});