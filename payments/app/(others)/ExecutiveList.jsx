import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from "../../src/services/storageService";
import { useRouter } from "expo-router";
import Screen from "../../src/ui/components/Screen";
import Card from "../../src/ui/components/Card";
import { tokens } from "../../src/ui/tokens";

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

      const res = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/executives`, {
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
      style={styles.execTouchable}
      onPress={() => router.push({
        pathname: '../CompanyList/ExecutiveCompanies',
        params: { execId: item.id, execUsername: item.username }
      })}
    >
      <Card style={styles.execCard} padded={true}>
        <View style={styles.executiveInfo}>
          <View style={styles.executiveIconWrapper}>
            <Ionicons name="person" size={22} color={tokens.colors.accent} />
          </View>
          <View style={styles.executiveDetails}>
            <Text style={styles.executiveName}>{item.username}</Text>
            <Text style={styles.executivePhone}>{item.mobile || "No phone"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={tokens.colors.textDim} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen title="Executives" subtitle="View list of executives">
      <Card style={styles.searchCard}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={20} color={tokens.colors.accent} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={tokens.colors.textDim}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(""); setFiltered(executives); }}>
              <Ionicons name="close-circle" size={20} color={tokens.colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </Card>
      <View style={styles.resultHeader}>
        <Text style={styles.resultsHeading}>
          {search ? `Search Results (${filtered.length})` : `All Executives (${executives.length})`}
        </Text>
      </View>
      <View style={styles.listFlex}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.accent} />
            <Text style={styles.loadingText}>Loading executives...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={filtered.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : { paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={tokens.colors.textDim} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchCard: { paddingVertical: 20, paddingHorizontal: 16, marginBottom: 24 },
  listFlex: { flex: 1, paddingHorizontal: 4 },
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
  resultsSection: { flex: 1 },
  resultHeader: {
    marginBottom: 10,
  },
  resultsHeading: { color: tokens.colors.text, fontSize: 16, fontWeight: '600' },
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
  execTouchable: { marginBottom: 14 },
  execCard: { paddingVertical: 14, paddingHorizontal: 14 },
  executiveItem: {},
  executiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  executiveIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(200, 241, 76, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  executiveDetails: {
    flex: 1,
  },
  executiveName: { color: tokens.colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  executivePhone: { color: tokens.colors.textDim, fontSize: 14 },
  arrowWrapper: {
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: { color: tokens.colors.textDim, fontSize: 16, fontWeight: '500', marginTop: 16, textAlign: 'center' },
  emptySubtext: { color: tokens.colors.textDim, fontSize: 14, marginTop: 4, textAlign: 'center', opacity: 0.6 },
});