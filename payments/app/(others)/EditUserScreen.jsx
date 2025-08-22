import { Text, StyleSheet, KeyboardAvoidingView, TextInput, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StorageService } from "@/src/services/storageService";

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
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholder="Full Name"
        editable={!loading}
      />

      <Text style={styles.label}>Phone</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        style={styles.input}
        placeholder="Phone"
        keyboardType="phone-pad"
        editable={!loading}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Updating..." : "Update"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
    marginLeft: 2,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 50,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
