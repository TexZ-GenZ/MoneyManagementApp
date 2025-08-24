import React, { useState, useEffect } from "react";
import { StorageService } from "@/src/services/storageService";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Alert,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import GridBackground from '../(others)/GridBGComponent';

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
          `${process.env.EXPO_PUBLIC_APP_URI}/admin/executives`,
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

  const handleShowUser = () => {
    if (!inputValue.trim()) {
      setError("Please enter email or phone.");
      return;
    }
    setError("");
    setLoading(true);

    const foundUsers = searchExecutives(inputValue);
    if (foundUsers.length > 0) {
      setUserDetails({
        id: foundUsers[0].id,
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
    
    Alert.alert(
      "Confirm Deactivation",
      "Are you sure you want to deactivate this user?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Deactivate", style: "destructive", onPress: performDeactivation },
      ]
    );
  };

  const performDeactivation = async () => {
    setError("");
    setLoading(true);

    try {
      const header = {
        ...(await StorageService.getAuthHeader()),
        "Content-Type": "application/json",
      };

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_APP_URI}/admin/users/${userDetails.id}`,
        {
          method: "DELETE",
          headers: header,
        }
      );

      if (!res.ok) {
        setError("An error occurred during this operation.");
      } else {
        Alert.alert("Success", "⚠️ User deactivated!");
        setUserDetails(null);
        setInputValue("");
      }
    } catch (err) {
      setError("An error occurred during this operation.");
    }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!userDetails) {
      setError("Fetch user details first.");
      return;
    }

    Alert.alert(
      "Permanent Deletion",
      "⚠️ This will permanently delete the user. This action cannot be undone!",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Forever", style: "destructive", onPress: performDeletion },
      ]
    );
  };

  const performDeletion = async () => {
    setError("");
    setLoading(true);

    try {
      const header = {
        ...(await StorageService.getAuthHeader()),
        "Content-Type": "application/json",
      };

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_APP_URI}/admin/users/${userDetails.id}/hard-delete`,
        {
          method: "DELETE",
          headers: header,
        }
      );

      if (!res.ok) {
        setError("An error occurred during this operation.");
      } else {
        Alert.alert("Success", "✅ User deleted successfully!");
        setUserDetails(null);
        setInputValue("");
      }
    } catch (err) {
      setError("An error occurred during this operation.");
    }
    setLoading(false);
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
        {/* Header */}
        <View style={styles.topBar}>
          <Text style={styles.title}>Delete User 🗑️</Text>
          <Text style={styles.subtitle}>Search and manage user accounts</Text>
        </View>

        {/* Search Card */}
        <View style={styles.cardContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#c8f14c"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter mobile / username"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="default"
            />
            {inputValue.length > 0 && (
              <TouchableOpacity onPress={() => setInputValue("")}>
                <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={handleShowUser}>
            <Ionicons name="search" size={16} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.searchButtonText}>Find User</Text>
          </TouchableOpacity>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#c8f14c" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* User Details Card */}
        {userDetails && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsHeading}>User Found</Text>
            <View style={styles.cardContainer}>
              <View style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userIconWrapper}>
                    <Ionicons name="person" size={24} color="#c8f14c" />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{userDetails.name}</Text>
                    <Text style={styles.userPhone}>{userDetails.phone}</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deactivateButton]} 
                  onPress={handleDeactivateUser}
                  disabled={loading}
                >
                  <Ionicons name="pause-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.deactivateButtonText}>Deactivate</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]} 
                  onPress={handleDeleteUser}
                  disabled={loading}
                >
                  <Ionicons name="trash" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.deleteButtonText}>Delete Forever</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Executives List */}
        <View style={styles.executivesSection}>
          <Text style={styles.resultsHeading}>All Executives ({executives.length})</Text>
          <View style={styles.cardContainer}>
            <FlatList
              data={executives}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.executiveItem}
                  onPress={() => setInputValue(item.username)}
                >
                  <View style={styles.executiveInfo}>
                    <View style={styles.executiveIconWrapper}>
                      <Ionicons name="person-outline" size={18} color="#c8f14c" />
                    </View>
                    <View style={styles.executiveDetails}>
                      <Text style={styles.executiveName}>{item.username}</Text>
                      <Text style={styles.executivePhone}>{item.mobile}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.4)" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={32} color="rgba(255, 255, 255, 0.3)" />
                  <Text style={styles.emptyText}>No executives found</Text>
                </View>
              }
            />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
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
  searchButton: {
    backgroundColor: '#c8f14c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  searchButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 8,
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  resultsSection: {
    marginBottom: 20,
  },
  resultsHeading: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 10,
    fontFamily: 'Inter',
  },
  userCard: {
    marginBottom: 16,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(200, 241, 76, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  deactivateButton: {
    backgroundColor: '#f59e0b',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  deactivateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  executivesSection: {
    flex: 1,
  },
  executiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  executiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  executiveIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(200, 241, 76, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  executiveDetails: {
    flex: 1,
  },
  executiveName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  executivePhone: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 8,
  },
});

export default DeleteUserScreen;