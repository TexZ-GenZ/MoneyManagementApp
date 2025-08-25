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

  // Header moved inline into ListHeaderComponent to avoid remounts and preserve TextInput focus

  return (
    <Screen title="Executives" subtitle="View list of executives">
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
            ListHeaderComponent={(
              <>
                <Card style={styles.searchCard}>
                  <View style={styles.searchRow}>
                    <Ionicons name="search-outline" size={20} color={tokens.colors.accent} style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by name or phone..."
                      placeholderTextColor={tokens.colors.textDim}
                      value={search}
                      onChangeText={handleSearch}
                      autoCorrect={false}
                      autoCapitalize='none'
                      returnKeyType='search'
                      blurOnSubmit={false}
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
              </>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
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
  // Align with themed search UI used elsewhere (Bills screen)
  searchCard: { marginBottom: 12, padding: 12 },
  listFlex: { flex: 1, paddingHorizontal: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: tokens.colors.text, fontSize: 16 },
  resultsSection: { flex: 1 },
  resultHeader: {
    marginBottom: 10,
  },
  resultsHeading: { color: tokens.colors.text, fontSize: 16, fontWeight: '700' },
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
  executiveIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
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