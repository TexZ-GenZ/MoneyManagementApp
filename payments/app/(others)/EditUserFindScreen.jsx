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
  SafeAreaView,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "../../src/ui/tokens";
import { StorageService } from "@/src/services/storageService";
import GridBackground from '../(others)/GridBGComponent';

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
          `${process.env.EXPO_PUBLIC_APP_URI}/admin/executives`,
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
    <LinearGradient
      colors={['#000', '#000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <GridBackground />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior="padding"
          keyboardVerticalOffset={100}
        >
          {/* Header */}
          <View style={styles.topBar}>
            <Text style={styles.title}>Find User 🔍</Text>
            <Text style={styles.subtitle}>Search by username or phone number</Text>
          </View>

          {/* Search Card */}
          <View style={styles.cardContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="search-outline"
                size={20}
                color={tokens.colors.accent}
                style={styles.searchIcon}
              />
              <TextInput
                placeholder="Enter username or phone"
                placeholderTextColor={tokens.colors.textDim}
                value={input}
                onChangeText={setInput}
                style={styles.input}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Ionicons name="search" size={16} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Results */}
          {filteredUsers.length > 0 && (
            <View style={styles.resultsSection}>
              <Text style={styles.resultsHeading}>Users Found</Text>
              <View style={styles.cardContainer}>
                <FlatList
                  data={filteredUsers}
                  keyExtractor={(item) => item.id.toString()}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleUserPress(item)}
                      style={styles.userItem}
                    >
                      <View style={styles.userInfo}>
                        <View style={styles.userIconWrapper}>
                          <Ionicons name="person" size={20} color={tokens.colors.accent} />
                        </View>
                        <View style={styles.userDetails}>
                          <Text style={styles.userName}>{item.username}</Text>
                          <Text style={styles.userPhone}>{item.mobile}</Text>
                        </View>
                      </View>
                      <View style={styles.editIconWrapper}>
                        <Text style={styles.arrow}>{'>'}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          )}
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
  title: { fontSize: 22, fontWeight: '700', color: tokens.colors.text },
  subtitle: {
    fontSize: 14,
    color: tokens.colors.textDim,
    marginTop: 4,
  },
  cardContainer: {
    backgroundColor: tokens.colors.cardAlt,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: tokens.colors.text },
  searchButton: {
    backgroundColor: tokens.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  searchButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: tokens.colors.danger,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  resultsSection: {
    flex: 1,
  },
  resultsHeading: {
    color: tokens.colors.text,
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '700',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.cardAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: { color: tokens.colors.text, fontSize: 16, fontWeight: '600', marginBottom: 2 },
  userPhone: { color: tokens.colors.textDim, fontSize: 14 },
  editIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.cardAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: tokens.colors.accent, fontSize: 18, marginLeft: 8 },
});