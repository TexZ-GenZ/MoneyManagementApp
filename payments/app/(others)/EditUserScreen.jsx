import { Text, StyleSheet, KeyboardAvoidingView, TextInput, TouchableOpacity, Alert, View, SafeAreaView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StorageService } from "@/src/services/storageService";
import GridBackground from '../(others)/GridBGComponent';

export default function EditUserScreen() {
  const router = useRouter();
  const { uphone, uname, upassword, userid } = useLocalSearchParams();

  const [name, setName] = useState(uname || "");
  const [phone, setPhone] = useState(uphone || "");
  const [password, setPassword] = useState(upassword || "");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const header = {
        ...(await StorageService.getAuthHeader()),
        "Content-Type": "application/json",
      };

      // Track if any request fails
      let hasError = false;

      // Create an array of promises for changes detected
      const promises = [];

      if (name !== (uname || "")) {
        promises.push(
          fetch(
            `${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/users/${userid}/username?username=${encodeURIComponent(name)}`,
            {
              method: "PATCH",
              headers: header,
            }
          ).then(async (res) => {
            if (!res.ok) {
              hasError = true;
              const err = await res.json();
              throw new Error(err.message || "Failed to update username");
            }
          })
        );
      }

      if (phone !== (uphone || "")) {
        promises.push(
          fetch(
            `${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/users/${userid}/mobile?mobile=${encodeURIComponent(phone)}`,
            {
              method: "PATCH",
              headers: header,
            }
          ).then(async (res) => {
            if (!res.ok) {
              hasError = true;
              const err = await res.json();
              throw new Error(err.message || "Failed to update mobile");
            }
          })
        );
      }

      if (password !== (upassword || "")) {
        promises.push(
          fetch(
            `${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/users/${userid}/password?new_password=${encodeURIComponent(password)}`,
            {
              method: "PATCH",
              headers: header,
            }
          ).then(async (res) => {
            if (!res.ok) {
              hasError = true;
              const err = await res.json();
              throw new Error(err.message || "Failed to update password");
            }
          })
        );
      }

      // Run all update requests in parallel
      await Promise.all(promises);

      if (hasError) {
        Alert.alert("❌ Update failed", "One or more updates did not succeed.");
      } else {
        Alert.alert("✅ Success", "User details updated!");
        router.replace("/"); // Navigate to home page
      }
    } catch (error) {
      Alert.alert("❌ Update failed", error.message || "Something went wrong.");
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>Edit Profile ✏️</Text>
            <Text style={styles.subtitle}>Update user information</Text>
          </View>

          {/* Form Card */}
          <View style={styles.cardContainer}>
            {/* Username Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#c8f14c" style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Enter username"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Phone Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#c8f14c" style={styles.inputIcon} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  placeholder="Enter phone number"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#c8f14c" style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  secureTextEntry
                  editable={!loading}
                />
              </View>
            </View>
          </View>

          {/* Update Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.updateButton, loading && styles.updateButtonDisabled]} 
              onPress={handleUpdate} 
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContent}>
                  <Text style={styles.updateButtonText}>Updating...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.updateButtonText}>Update Profile</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 30,
  },
  updateButton: {
    backgroundColor: '#c8f14c',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonDisabled: {
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
  updateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});