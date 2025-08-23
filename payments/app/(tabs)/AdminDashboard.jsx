import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GridBackground from '../(others)/GridBGComponent';
import { useEffect, useState } from 'react';
import { StorageService } from '../../src/services/storageService';

const { width } = Dimensions.get('window');

export default function AccountantDashboard() {
  const [recentPayments, setRecentPayments] = useState([]);
  const router = useRouter();

  const buttons = [
    { label: 'Approve', icon: 'alert-circle-outline', action: () => { router.push('../(others)/NotifyAdmin') } },
    { label: 'Companies', icon: 'business-outline', action: () => { router.push('../CompanyList/AllCompanies') } },
    { label: 'Executives', icon: 'person-outline', action: () => { router.push('../(others)/ExecutiveList') } },
    { label: 'Delete', icon: 'trash-outline', action: () => { router.push('../(others)/DeleteUser') } },
    { label: 'Add', icon: 'person-add-outline', action: () => { router.push('../(others)/AddMember') } },
    { label: 'Edit', icon: 'pencil-outline', action: () => { router.push('../(others)/EditUserFindScreen') } },
  ];

  // Fetch recent payments
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const token = await StorageService.getToken();
        const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/payments/pending?skip=0&limit=5`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
          },
        });
        const data = await response.json();
        
        if (response.ok) {
          setRecentPayments(data.items || []);
        } else {
          console.error("Error fetching payments:", data);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };
    fetchPayments();
  }, []);

  return (
    <LinearGradient
      colors={['#000', '#000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <GridBackground />
      <SafeAreaView style={styles.container}>
        {/* Top Section */}
        <View style={styles.topBar}>
          <Text style={styles.heading}>Welcome Back 👋</Text>
          <Text style={styles.subheading}>Here's your quick access</Text>
        </View>

        {/* Card Container */}
        <View style={styles.cardContainer}>
          <View style={styles.grid}>
            {buttons.map((btn, index) => (
              <TouchableOpacity key={index} style={[styles.iconWrapper, { marginTop: 18 }]} onPress={btn.action}>
                <View style={{ padding: 12, borderRadius: 32, backgroundColor: '#c8f14c' }}>
                  <Ionicons name={btn.icon} size={28} color="#000" />
                </View>
                <Text style={styles.label}>
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Section */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.recentHeading}>Recent</Text>
          <View style={styles.cardContainer}>
          <FlatList
            data={recentPayments}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.recentItem}>
                <Ionicons name="cash-outline" size={22} color="#c8f14c" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.recentTitle}>{item.company_code || "Unknown Company"}</Text>
                  <Text style={styles.recentSubtitle}>
                    {item.amount_collected ? `₹${item.amount_collected}` : "No Amount"} • {new Date(item.collected_at).toLocaleDateString('en-IN') || "Pending"}
                  </Text>
                </View>
              </View>
            )}
          />
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
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9f9f9',
  },
  subheading: {
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  iconWrapper: {
    width: (width - 80) / 3,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: 'white',
    marginTop: 8,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  recentHeading: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 10,
    fontFamily: 'Inter',
    textAlign: 'left',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  recentTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  recentSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
});
