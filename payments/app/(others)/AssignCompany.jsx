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
    { name: 'Hello Comp', code: 'XY-112' },
    { name: 'ABC', code: 'XYZ-02' },
    { name: 'Hello Comp', code: 'XY-12' }
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafd", // Soft mint background
  },
  infoBox: {
    borderWidth: 0,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    backgroundColor: "#e6fbfa", // Lighter mint
    shadowColor: "#c2e6f0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 15,
    color: "#24507a",
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
    color: "#152642",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 16,
    backgroundColor: "#e6fbfa",
    padding: 14,
    borderRadius: 14,
    shadowColor: "#c2e6f0",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#143764",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  input: {
    borderWidth: 0,
    backgroundColor: "#ffffffff",
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    color: "#183b56",
    fontWeight: "500",
    elevation: 1,
    shadowColor: "#d6f3ee",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
  },
  button: {
    backgroundColor: "#2266f1",
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 0,
    alignItems: "center",
    marginTop: 5,
    shadowColor: "#9EC0FC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 9,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  unassignButton: {
    backgroundColor: "#e12d39",
    minWidth: 90,
    marginLeft: 10,
    paddingVertical: 10,
  },
  companyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#edf7fe",
    borderWidth: 0,
    marginBottom: 15,
    shadowColor: "#93c7e7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 5,
    elevation: 2,
  },
  companyName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#205380",
  },
  companyCode: {
    fontSize: 15,
    color: "#5686aa",
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    color: "#8e9ab6",
    marginTop: 16,
    fontSize: 15,
    fontWeight: "500",
  }
});
