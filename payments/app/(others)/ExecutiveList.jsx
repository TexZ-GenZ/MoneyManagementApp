import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import {StorageService} from "../../src/services/storageService";

import {useRouter} from "expo-router"

const sampledata= [
  {
    "id": 1,
    "username": "alice",
    "role": "admin",
    "area": "north",
    "mobile": "9876543210"
  },
  {
    "id": 2,
    "username": "bob",
    "role": "editor",
    "area": "south",
    "mobile": "9123456780"
  },
  {
    "id": 3,
    "username": "charlie",
    "role": "viewer",
    "area": "east",
    "mobile": "9988776655"
  },
  {
    "id": 4,
    "username": "diana",
    "role": "admin",
    "area": "west",
    "mobile": "8877665544"
  },
  {
    "id": 5,
    "username": "eric",
    "role": "editor",
    "area": "central",
    "mobile": "9090909090"
  },
  {
    "id": 6,
    "username": "fiona",
    "role": "viewer",
    "area": "north",
    "mobile": "8123456789"
  },
  {
    "id": 7,
    "username": "george",
    "role": "admin",
    "area": "south",
    "mobile": "7008009001"
  },
  {
    "id": 8,
    "username": "hannah",
    "role": "editor",
    "area": "east",
    "mobile": "6007008009"
  }
]


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
      style={styles.card}
      onPress={()=>router.push({
        pathname: '../(others)/AssignCompany',
        params : {execId : item.id, execUsername:item.username, execMobile : item.mobile}
      })}
    >
      <Text style={styles.name}>{item.username}</Text>
      <Text style={styles.info}>{item.mobile || "No phone"}</Text>
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
