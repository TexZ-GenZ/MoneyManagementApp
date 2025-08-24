import { useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { StorageService } from "../../src/services/storageService";

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI;

export default function ExecutiveDetailsScreen() {
  const { execId, execMobile, execUsername } = useLocalSearchParams();

  const [currentCompanies, setCurrentCompanies] = useState([]);
  const [companyCode, setCompanyCode] = useState('');
  const [companyDetails, setCompanyDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingCompany, setFetchingCompany] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningCompany, setAssigningCompany] = useState(false);
  const [role, setRole] = useState(null); // decoded role for permission logic

  const fetchAuthHeader = async () => {
    let header = await StorageService.getAuthHeader();
    return header ? header : null
  }


  useEffect(() => {
    decodeRole();
    fetchAssignedCompanies();
  }, []);

  const decodeRole = async () => {
    try {
      const tok = await StorageService.getToken();
      if (!tok?.access_token) return;
      const parts = tok.access_token.split('.');
      if (parts.length < 2) return;
      const payloadJson = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      setRole(payloadJson.role || payloadJson.roles || payloadJson['https://role'] || null);
    } catch (e) {
      setRole(null);
    }
  };

  useEffect(() => {
    const delayedFetch = setTimeout(() => {
      if (companyCode.trim().length > 0) {
        fetchCompanyDetails();
      } else {
        setCompanyDetails(null);
      }
    }, 500);

    return () => clearTimeout(delayedFetch);
  }, [companyCode]);

  const fetchAssignedCompanies = async () => {
    if (!execId) return;

    try {
      setLoading(true);
      const header = await fetchAuthHeader();

      const response = await fetch(`${API_BASE_URL}/executives/${execId}/companies`, {
        method: 'GET',
        headers: header,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const companies = Array.isArray(data) ? data : (data.companies || data.items || []);
      setCurrentCompanies(companies);

    } catch (error) {
      console.error('Error fetching assigned companies:', error);
      Alert.alert('Error', 'Failed to fetch assigned companies. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCompanyDetails = async () => {
    const code = companyCode.trim();
    if (!code) return;

    try {
      setFetchingCompany(true);
      const header = await fetchAuthHeader();

      // Try to fetch company details - you might need to adjust this endpoint
      const response = await fetch(`${API_BASE_URL}/companies/${code}`, {
        method: 'GET',
        headers: header,
      });

      if (response.ok) {
        const company = await response.json();
        setCompanyDetails(company);
      } else if (response.status === 404) {
        setCompanyDetails(null);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error fetching company details:', error);
      setCompanyDetails(null);
    } finally {
      setFetchingCompany(false);
    }
  };

  const handleAssign = async () => {
    if (role === 'accountant') return; // safeguard
    if (!companyDetails || !execId) return;

    try {
      const header = await fetchAuthHeader();
      setAssigningCompany(true);

      const response = await fetch(`${API_BASE_URL}/admin/executives/${execId}/assign/${companyCode.trim()}`, {
        method: 'POST',
        headers: header,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Add to current companies list
      const newCompany = {
        name: companyDetails.name || companyDetails.company_name,
        code: companyCode.trim(),
        ...companyDetails
      };

      setCurrentCompanies(prev => [...prev, newCompany]);
      setCompanyCode('');
      setCompanyDetails(null);

      Alert.alert('Success', `Successfully assigned ${newCompany.name} to ${execUsername}`);

    } catch (error) {
      console.error('Error assigning company:', error);
      Alert.alert('Error', error.message || 'Failed to assign company. Please try again.');
    } finally {
      setAssigningCompany(false);
    }
  };

  const handleUnassign = async (company) => {
    if (role === 'accountant') return; // read-only for accountants
    Alert.alert(
      "Confirm Unassign",
      `Are you sure you want to unassign ${company.name} from ${execUsername}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unassign",
          style: "destructive",
          onPress: async () => {
            try {
              const header = await fetchAuthHeader();


              const response = await fetch(`${API_BASE_URL}/admin/executives/${execId}/assign/${company.code}`, {
                method: 'DELETE',
                headers: header,
              });

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              setCurrentCompanies(prev => prev.filter(c => c.code !== company.code));
              Alert.alert('Success', `Successfully unassigned ${company.name}`);

            } catch (error) {
              console.error('Error unassigning company:', error);
              Alert.alert('Error', 'Failed to unassign company. Please try again.');
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignedCompanies();
  };

  const renderCompanyItem = ({ item }) => (
    <View style={styles.companyCard}>
      <View style={styles.companyInfo}>
        <Text style={styles.companyName}>{item.name || item.company_name}</Text>
        <Text style={styles.companyCode}>{item.code || item.company_code}</Text>
      </View>
      {role !== 'accountant' && (
        <TouchableOpacity
          style={styles.unassignButton}
          onPress={() => handleUnassign(item)}
        >
          <Text style={styles.unassignButtonText}>Unassign</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Executive Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Executive Details</Text>
        <Text style={styles.infoName}>{execUsername}</Text>
        <Text style={styles.infoMobile}>{execMobile}</Text>
        <Text style={styles.infoId}>ID: {execId}</Text>
      </View>

      {/* Assign Company Section (hidden for accountants) */}
      {role !== 'accountant' && (
        <View style={styles.assignSection}>
          <Text style={styles.sectionTitle}>Assign New Company</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter company code"
              value={companyCode}
              onChangeText={setCompanyCode}
              autoCapitalize="characters"
            />
            {fetchingCompany && (
              <ActivityIndicator
                style={styles.inputLoader}
                size="small"
                color="#666"
              />
            )}
          </View>

          {companyDetails && (
            <View style={styles.companyPreview}>
              <Text style={styles.previewLabel}>Company Found:</Text>
              <Text style={styles.previewName}>{companyDetails.name || companyDetails.company_name}</Text>
              <Text style={styles.previewCode}>{companyCode}</Text>

              <TouchableOpacity
                style={styles.assignButton}
                onPress={handleAssign}
                disabled={assigningCompany}
              >
                {assigningCompany ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.assignButtonText}>Assign Company</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {companyCode.trim().length > 0 && !fetchingCompany && !companyDetails && (
            <View style={styles.notFoundBox}>
              <Text style={styles.notFoundText}>Company not found</Text>
            </View>
          )}
        </View>
      )}

      {/* Current Companies */}
      <View style={styles.companiesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Companies</Text>
          <Text style={styles.countText}>
            {currentCompanies.length} compan{currentCompanies.length !== 1 ? 'ies' : 'y'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#666" size="large" />
            <Text style={styles.loadingText}>Loading companies...</Text>
          </View>
        ) : (
          <FlatList
            data={currentCompanies}
            keyExtractor={item => item.code || item.company_code}
            renderItem={renderCompanyItem}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No companies assigned yet.</Text>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  infoBox: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    marginBottom: 8,
  },
  infoName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  infoMobile: {
    fontSize: 14,
    color: "#000",
    marginBottom: 2,
  },
  infoId: {
    fontSize: 12,
    color: "#666",
  },
  assignSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#000",
  },
  inputLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  companyPreview: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  previewLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  previewCode: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  assignButton: {
    backgroundColor: "#007bff",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  assignButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  notFoundBox: {
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ffeaa7",
  },
  notFoundText: {
    color: "#856404",
    fontSize: 14,
    textAlign: "center",
  },
  companiesSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  countText: {
    fontSize: 12,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  companyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  companyCode: {
    fontSize: 14,
    color: "#666",
  },
  unassignButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  unassignButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    paddingVertical: 40,
  },
});