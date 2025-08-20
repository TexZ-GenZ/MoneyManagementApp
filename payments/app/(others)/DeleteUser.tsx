import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

const DeleteUserScreen = () => {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [error, setError] = useState("");

  const handleShowUser = async () => {
    if (!inputValue.trim()) {
      setError("Please enter email or phone.");
      return;
    }
    setError("");
    setLoading(true);

    // 🔗 Replace with API call to fetch user details
    setTimeout(() => {
      setUserDetails({
        name: "John Doe",
        email: "john@example.com",
        phone: "+91 9876543210",
      });
      setLoading(false);
    }, 1500);
  };

  const handleDeleteUser = async () => {
    if (!userDetails) {
      setError("Fetch user details first.");
      return;
    }
    setError("");
    setLoading(true);

    // 🔗 Replace with API call to delete user
    setTimeout(() => {
      setUserDetails(null);
      setInputValue("");
      setLoading(false);
      alert("✅ User deleted successfully!");
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delete User</Text>
      <Text style={styles.subtitle}>
        Enter user email or phone number to delete
      </Text>

      {/* Input */}
      <TextInput
        style={styles.input}
        placeholder="Enter Email or Phone"
        value={inputValue}
        onChangeText={setInputValue}
        keyboardType="default"
      />

      {/* Show User Button */}
      <TouchableOpacity style={styles.showUserBtn} onPress={handleShowUser}>
        <Text style={styles.showUserText}>Show User</Text>
      </TouchableOpacity>

      {/* Loading Spinner */}
      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}

      {/* Error */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* User Details */}
      {userDetails && (
        <View style={styles.userCard}>
          <Text style={styles.userInfo}>Name: {userDetails.name}</Text>
          <Text style={styles.userInfo}>Email: {userDetails.email}</Text>
          <Text style={styles.userInfo}>Phone: {userDetails.phone}</Text>
        </View>
      )}

      {/* Deactivate Button */}
      <TouchableOpacity
        style={styles.deactivateBtn}
        onPress={() => alert("⚠️ User deactivated!")}
      >
        <Text style={styles.deactivateBtnText}>Deactivate User</Text>
      </TouchableOpacity>

      {/* Delete Button */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteUser}>
        <Text style={styles.deleteBtnText}>Delete User</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  showUserBtn: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 20,
  },
  showUserText: {
    color: "#fff",
    fontWeight: "500",
  },
  errorText: {
    color: "red",
    marginTop: 10,
  },
  userCard: {
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
  },
  userInfo: {
    fontSize: 16,
    marginBottom: 5,
  },
  deactivateBtn: {
    marginTop:"auto",
    backgroundColor: "#f0ad4e", // Orange-ish for warning
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15, // spacing before delete button
  },
  deactivateBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  deleteBtn: {
    marginBottom: 15,
    backgroundColor: "#d9534f",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default DeleteUserScreen;
