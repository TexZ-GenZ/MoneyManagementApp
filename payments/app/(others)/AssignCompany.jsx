import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from "react-native";

// Fake service/sample for demonstration
const fetchCompanyNameByCode = async (companyCode) => {
  // Replace with real DB/API call as needed.
  const companies = {
    'XYZ-012': 'ABC',
    'XY-112': 'Hello Comp',
    'MNO-789': 'MNO Company'
  };
  return companies[companyCode] || 'Unknown Company';
};

export default function ExecutiveDetailsScreen() {
  const { execId, execMobile, execUsername } = useLocalSearchParams(); // Contains { username, mobile, ... }

  // Companies assigned to this executive (replace with real API/state)
  const [currentCompanies, setCurrentCompanies] = useState([
    { name: 'ABC', code: 'XYZ-012' },
    { name: 'Hello Comp', code: 'XY-112' }
  ]);
  const [companyCode, setCompanyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!companyCode.trim()) return;
    setLoading(true);
    const companyName = await fetchCompanyNameByCode(companyCode.trim());
    setLoading(false);

    Alert.alert(
      "Confirm Assignment",
      `Do you want to assign ${companyName} to ${execUsername}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Assign",
          style: "default",
          onPress: () => {
            setCurrentCompanies([...currentCompanies, { name: companyName, code: companyCode.trim() }]);
            setCompanyCode('');
          }
        }
      ]
    );
  };

  const handleUnassign = (code) => {
    setCurrentCompanies(currentCompanies.filter(c => c.code !== code));
  };

  return (
    <View style={styles.container}>
      {/* Executive Info */}
      <View style={styles.infoBox}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>{execUsername}</Text>
        <Text style={styles.label}>{execMobile}</Text>
      </View>

      {/* Assign Company */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assign Company</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter company code"
          value={companyCode}
          onChangeText={setCompanyCode}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.button} onPress={handleAssign} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Assign</Text>}
        </TouchableOpacity>
      </View>

      {/* Current Companies */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Current Companies</Text>
      <FlatList
        data={currentCompanies}
        keyExtractor={item => item.code}
        renderItem={({ item }) => (
          <View style={styles.companyCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>{item.name}</Text>
              <Text style={styles.companyCode}>{item.code}</Text>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.unassignButton]}
              onPress={() => handleUnassign(item.code)}
            >
              <Text style={styles.buttonText}>Unassign</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No companies assigned.</Text>}
      />
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff"
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#f8faff"
  },
  label: {
    fontSize: 18,
    color: "#333",
    fontWeight: "600",
    marginBottom: 4
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f4287",
    marginBottom: 10
  },
  section: {
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1f4287"
  },
  input: {
    borderWidth: 1,
    borderColor: "#1f75fe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16
  },
  button: {
    backgroundColor: "#1f75fe",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700"
  },
  unassignButton: {
    backgroundColor: "#2970f0",
    marginLeft: 10,
    minWidth: 90
  },
  companyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#f1f7ff",
    borderWidth: 1,
    borderColor: "#bbdefb",
    marginBottom: 14
  },
  companyName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f4287"
  },
  companyCode: {
    fontSize: 15,
    color: "#607d8b"
  },
  emptyText: {
    textAlign: "center",
    color: "#999"
  }
});
