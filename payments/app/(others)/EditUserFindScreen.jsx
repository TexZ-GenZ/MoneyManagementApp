import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StorageService } from "@/src/services/storageService";

export default function EditUserFindScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

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
          setError("Failed to fetch users");
          return;
        }

        const data = await res.json();
        setUsers(data);
        setFilteredUsers(data); // show all initially
      } catch (err) {
        setError("Error fetching users");
        console.error(err);
      }
    };

    fetchExecutives();
  }, []);

  const handleSearch = () => {
    const term = input.trim().toLowerCase();
    if (!term) {
      setFilteredUsers(users);
      setError("");
      return;
    }

    const foundUsers = users.filter(
      (user) =>
        user.username.toLowerCase().includes(term) ||
        (user.mobile && user.mobile.toLowerCase().includes(term))
    );

    if (foundUsers.length === 0) {
      setError("❌ User not found. Try again.");
    } else {
      setError("");
    }
    setFilteredUsers(foundUsers);
  };

  const handleUserPress = (user) => {
    router.push({
      pathname: "../(others)/EditUserScreen",
      params: {
        uphone: user.mobile,
        uname: user.username,
        upassword: "", // password not fetched here
        userid: user.id,
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={100}
    >
      <Text style={styles.title}>Find User</Text>

      <View style={styles.inputWrapper}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#666"
          style={{ marginRight: 10 }}
        />
        <TextInput
          placeholder="Enter username or phone"
          value={input}
          onChangeText={setInput}
          style={styles.input}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSearch}>
        <Text style={styles.buttonText}>Search</Text>
      </TouchableOpacity>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id.toString()}
        style={{ marginTop: 20 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleUserPress(item)}
            style={styles.userItem}
          >
            <View style={styles.userRow}>
              <Text style={styles.userText}>
                {item.username} - {item.mobile}
              </Text>
              <Ionicons name="pencil-outline" size={22} color="#4F46E5" />
            </View>
          </TouchableOpacity>
        )}
      />
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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    marginBottom: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
  userItem: {
    paddingVertical: 12,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userText: {
    fontSize: 16,
    color: "#111",
  },
});
