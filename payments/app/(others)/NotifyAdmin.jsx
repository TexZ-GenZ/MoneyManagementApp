import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Mock executiveId to name mapping
const executiveNames = {
  0: "Test Exec",
  1: "Alice",
  2: "Bob",
  3: "Charlie"
};

// Mocked admin approval data
const mockAdminApprovalItems = [
  {
    id: 1,
    company_code: "ABC-001",
    collected_at: "2025-08-22T03:25:48.172Z",
    amount_collected: "8550",
    method: "Bank Transfer",
    status: "pending",
    executive_id: 1,
    next_promise_date: "2025-08-28",
    exec_location_verified: true
  },
  {
    id: 2,
    company_code: "XYZ-002",
    collected_at: "2025-08-20T15:00:12.755Z",
    amount_collected: "2400",
    method: "UPI",
    status: "pending",
    executive_id: 2,
    next_promise_date: "2025-08-29",
    exec_location_verified: false
  }
];

export default function AdminApprovalScreen() {
  const [search, setSearch] = useState("");
  const [approvalItems, setApprovalItems] = useState(mockAdminApprovalItems);

  // Filter items by company or exec name
  const filteredItems = approvalItems.filter(item =>
    item.company_code.toLowerCase().includes(search.toLowerCase()) ||
    (executiveNames[item.executive_id] || "").toLowerCase().includes(search.toLowerCase())
  );

  // Refresh handler (replace with your API)
  const handleRefresh = () => {
    setApprovalItems([...mockAdminApprovalItems]);
  };

  const handleApprove = (id) => {
    alert(`Payment ID ${id} approved by Admin!`);
    // API call here
  };

  const handleReject = (id) => {
    alert(`Payment ID ${id} rejected by Admin!`);
    // API call here
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.company}>{item.company_code}</Text>
        <Text style={styles.date}>{(new Date(item.collected_at)).toLocaleDateString()}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.exec}>Executive: <Text style={{ fontWeight: 'bold' }}>{executiveNames[item.executive_id] || item.executive_id}</Text></Text>
        <Text style={styles.status}>{item.status.toUpperCase()}</Text>
      </View>
      <Text style={styles.info}>Method: <Text style={styles.infoValue}>{item.method}</Text></Text>
      <Text style={styles.info}>
        Next Promise Date: <Text style={styles.infoValue}>{item.next_promise_date}</Text>
      </Text>
      <Text style={styles.info}>
        Location Verified: <Text style={styles.infoValue}>{item.exec_location_verified ? "Yes" : "No"}</Text>
      </Text>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>₹{item.amount_collected}</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleApprove(item.id)}>
          <Ionicons name="checkmark-circle" size={32} color="#189A7D" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleReject(item.id)}>
          <Ionicons name="close-circle" size={32} color="#e25656" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search by Name and Refresh */}
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Name"
          placeholderTextColor="#b2b2b2"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#215087" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No approvals found.</Text>}
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafd",
    padding: 16
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    borderColor: "#b2d9e8",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 16,
    marginRight: 10
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: "#e8f2fc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#b4dcea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.11,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e6f2fb"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  company: {
    fontSize: 15,
    fontWeight: "700",
    color: "#215087"
  },
  date: {
    fontSize: 13,
    color: "#888"
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  exec: {
    fontSize: 14,
    color: "#184977"
  },
  status: {
    fontSize: 13,
    color: "#aa8603",
    fontWeight: "bold"
  },
  info: {
    fontSize: 13,
    color: "#444",
    marginBottom: 2,
    marginTop: 2
  },
  infoValue: {
    color: "#2279d2",
    fontWeight: "600"
  },
  amountRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end"
  },
  amount: {
    fontSize: 22,
    fontWeight: "700",
    color: "#189A7D",
    marginRight: 12,
    marginLeft: "auto"
  },
  actionBtn: {
    marginLeft: 7
  },
  empty: {
    color: "#8e99b6",
    fontSize: 16,
    textAlign: "center",
    marginTop: 35
  }
});
