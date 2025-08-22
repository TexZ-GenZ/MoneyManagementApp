import React, { useState, useEffect } from "react";
import { StorageService } from "@/src/services/storageService";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DeleteUserScreen = () => {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [error, setError] = useState("");
  const [executives, setExecutives] = useState([]);

  useEffect(() => {
    const fetchExecutives = async () => {
      try {
        const header = {
          ...(await StorageService.getAuthHeader()),
          "Content-Type": "application/json",
        };

        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/executives`,
          {
            method: "GET",
            headers: header,
          }
        );

        if (!res.ok) {
          console.error("Failed to fetch executives:", res.status);
          return;
        }

        const data = await res.json();
        setExecutives(data);
      } catch (err) {
        console.error("Error fetching executives:", err);
      }
    };

    fetchExecutives();
  }, []);

  const searchExecutives = (searchTerm) => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return executives.filter(
      (exec) =>
        exec.username.toLowerCase().includes(term) ||
        (exec.mobile && exec.mobile.toLowerCase().includes(term))
    );
  };

  const handleShowUser = async () => {
    if (!inputValue.trim()) {
      setError("Please enter email or phone.");
      return;
    }
    setError("");
    setLoading(true);

    const foundUsers = searchExecutives(inputValue);
    if (foundUsers.length > 0) {
      setUserDetails({
        id: foundUsers[0].id, // Storing the user ID
        name: foundUsers[0].username,
        phone: foundUsers[0].mobile,
      });
    } else {
      setError("User not found.");
      setUserDetails(null);
    }
    setLoading(false);
  };

  const handleDeactivateUser = async () => {
    if (!userDetails) {
      setError("Fetch user details first.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const header = {
        ...(await StorageService.getAuthHeader()),
        "Content-Type": "application/json",
      };

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/users/${userDetails.id}`,
        {
          method: "DELETE",
          headers: header,
        }
        
      );

      if (!res.ok) {
        const resData = await res.json();
        setError(resData.message || "Failed to deactivate user.");
      } else {
        alert("⚠️ User deactivated!");
        setUserDetails(null);
        setInputValue("");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!userDetails) {
      setError("Fetch user details first.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const header = {
        ...(await StorageService.getAuthHeader()),
        "Content-Type": "application/json",
      };

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/users/${userDetails.id}/hard-delete`,
        {
          method: "DELETE",
          headers: header,
        }
      );

      if (!res.ok) {
        const resData = await res.json();
        setError(resData.message || "Failed to delete user.");
      } else {
        alert("✅ User deleted successfully!");
        setUserDetails(null);
        setInputValue("");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delete User</Text>

      <View style={styles.inputWrapper}>
        <Ionicons
          name="call-outline"
          size={20}
          color="#666"
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter mobile / username"
          value={inputValue}
          onChangeText={setInputValue}
          keyboardType="default"
        />
      </View>

      <TouchableOpacity style={styles.showUserBtn} onPress={handleShowUser}>
        <Text style={styles.showUserText}>Show User</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {userDetails && (
        <View style={styles.userCard}>
          <Text style={styles.userInfo}>
            <Ionicons name="person-circle-outline" size={18} color="#4F46E5" />{" "}
            {userDetails.name}
          </Text>

          <Text style={styles.userInfo}>
            <Ionicons name="call-outline" size={18} color="#4F46E5" />{" "}
            {userDetails.phone}
          </Text>
        </View>
      )}

      {userDetails && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.deactivateBtn}
            onPress={handleDeactivateUser} // Correct: Pass function reference
          >
            <Text style={styles.deactivateBtnText}>Deactivate User</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteUser}>
            <Text style={styles.deleteBtnText}>Delete User</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 25,
    color: "#111827",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    marginBottom: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  showUserBtn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  showUserText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  errorText: {
    color: "red",
    marginTop: 10,
    fontSize: 14,
  },
  userCard: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 1, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  userInfo: {
    fontSize: 16,
    marginBottom: 10,
    color: "#374151",
  },
  actions: {
    marginTop: "auto",
    marginBottom: 35
  },
  deactivateBtn: {
    backgroundColor: "#f59e0b",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  deactivateBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  deleteBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

export default DeleteUserScreen;
