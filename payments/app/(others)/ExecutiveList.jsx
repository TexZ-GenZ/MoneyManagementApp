import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";

export default function AdminExecutiveList({ navigation }) {
  const [executives, setExecutives] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExecutives();
  }, []);

  const fetchExecutives = async () => {
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/executives`);
      console.log(`${process.env.EXPO_PUBLIC_API_BASE_URL}/admin/executives`)
      const data = await res.json();
      console.log(data)
      setExecutives(data);
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
        ex.name.toLowerCase().includes(lower) ||
        (ex.phone && ex.phone.toLowerCase().includes(lower))
    );
    setFiltered(results);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("ExecutiveDetails", { executive: item })}
    >
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.info}>{item.phone || "No phone"}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Executives</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or phone..."
        value={search}
        onChangeText={handleSearch}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>No executives found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#f9f9f9",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  info: {
    fontSize: 14,
    color: "#555",
  },
  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 16,
  },
});
