import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {StorageService} from "../../src/services/storageService";
import GridBackground from '../(others)/GridBGComponent';

import {useRouter} from "expo-router"

export default function AdminExecutiveList() {
  const [executives, setExecutives] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const router = useRouter()

  useEffect(() => {
    fetchExecutives();
  }, []);

  const fetchExecutives = async () => {
    try {
      let header = await StorageService.getAuthHeader();

      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/executives`,{
       headers: header
      });

      const data = await res.json();

      setExecutives(data);
      setFiltered(data);

      // fit with sample data
      setExecutives(data)
      setFiltered(data);

    } catch (err) {
      console.error("Error fetching executives:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(executives);
      return;
    }
    const lower = text.toLowerCase();
    const results = executives.filter(
      (ex) =>
        ex.username.toLowerCase().includes(lower) ||
        (ex.mobile && ex.mobile.toLowerCase().includes(lower))
    );
    setFiltered(results);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.executiveItem}
      onPress={()=>router.push({
        pathname: '../(others)/AssignCompany',
        params : {execId : item.id, execUsername:item.username, execMobile : item.mobile}
      })}
    >
      <View style={styles.executiveInfo}>
        <View style={styles.executiveIconWrapper}>
          <Ionicons name="person" size={22} color="#c8f14c" />
        </View>
        <View style={styles.executiveDetails}>
          <Text style={styles.executiveName}>{item.username}</Text>
          <Text style={styles.executivePhone}>{item.mobile || "No phone"}</Text>
        </View>
      </View>
      <View style={styles.arrowWrapper}>
        <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.4)" />
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.title}>Executives 👥</Text>
          <Text style={styles.subtitle}>Manage and assign companies</Text>
        </View>

        {/* Search Card */}
        <View style={styles.cardContainer}>
          <View style={styles.searchWrapper}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#c8f14c"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={search}
              onChangeText={handleSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearch("");
                setFiltered(executives);
              }}>
                <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        <View style={styles.resultsSection}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultsHeading}>
              {search ? `Search Results (${filtered.length})` : `All Executives (${executives.length})`}
            </Text>
          </View>
          
          <View style={styles.cardContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#c8f14c" />
                <Text style={styles.loadingText}>Loading executives...</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                    <Text style={styles.emptyText}>
                      {search ? "No executives match your search" : "No executives found"}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {search ? "Try a different search term" : "Add executives to get started"}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
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
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  resultsSection: {
    flex: 1,
  },
  resultHeader: {
    marginBottom: 10,
  },
  resultsHeading: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
    fontSize: 14,
  },
  executiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  executiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  executiveIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(200, 241, 76, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  executiveDetails: {
    flex: 1,
  },
  executiveName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  executivePhone: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  arrowWrapper: {
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});