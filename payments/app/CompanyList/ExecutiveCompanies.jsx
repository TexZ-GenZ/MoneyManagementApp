import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StorageService } from "../../src/services/storageService";

// Demo fetch -- replace with real API call
// const fetchCompanies = async()=>{
//   const res = await 
//   console.log(res.json())
//   return res.json()
// } 
export default function CompanyListScreen() {
  const [companies, setCompanies] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const router = useRouter()

  useEffect(() => {
    loadCompanies();
  }, []);

    const fetchAuthHeader = async () => {
      let header = await StorageService.getAuthHeader();
      return header ? header : null
    }

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const header = await fetchAuthHeader();
      const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/executives/5/companies`, {
        method: "GET",
        headers: header
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const dataArr = data.items

      console.log(dataArr);

      setCompanies(dataArr);
      setFiltered(dataArr);
    } catch (e) {
      setCompanies([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(companies);
      return;
    }
    const lower = text.toLowerCase();
    const results = companies.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.code && c.code.toLowerCase().includes(lower))
    );
    setFiltered(results);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.5} onPress={() => router.push({
      pathname: "../(others)/BiilsScreen",
      params: { name: item.name, code: item.code, amount: item.amount, outbal: item.outbal }
    })}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.code}>{item.code}</Text>
      </View>
       <Text style={styles.value}>{item.area}</Text>

      <Text style={styles.label}>Credit: <Text style={styles.value}>{item.credit_date}</Text></Text>

      <Text style={[styles.label, { marginLeft: 0 }]}>Promise : <Text style={styles.value}>{item.promise_date}</Text></Text>
      {/* </View> */}
      <View >
        <Text style={styles.label}>Outbal: <Text style={[styles.value, { color: "#e26660" }]}>{item.outbal}</Text></Text>
        <Text style={[styles.label]}>Amount: <Text style={[styles.value]}>{item.amount}</Text></Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Companies</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by company name or code"
        value={search}
        onChangeText={handleSearch}
        placeholderTextColor="#abc"
      />
      {loading ? (
        <ActivityIndicator size="large" color="#1f75fe" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>No companies found.</Text>}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafd",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#102943",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#e6fbfa",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    color: "#1c4064",
    borderWidth: 1,
    borderColor: "#d0e0e0",
    fontWeight: "500",
    shadowColor: "#bae4ec",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#bae4ec",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 9,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  name: {
    fontSize: 18,
    fontWeight: "500",
    color: "#000",
    flex: 1,
    flexWrap: "wrap",
  },
  code: {
    fontSize: 14,
    color: "#000",
    fontWeight: "400",
    marginLeft: 8,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    marginTop: 3,
    marginBottom: 1,
    alignItems: "center"
  },
  label: {
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
    fontWeight: "400",
    marginTop: 4,
  },
  value: {
    fontWeight: "400",
    color: "#000",
    fontSize: 14,
  },
  empty: {
    color: "#8e99b6",
    textAlign: "center",
    fontSize: 16,
    padding: 24,
  }
});
