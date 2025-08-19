import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');


export default function AccountantDashboard() {
  const buttons = [
    { label: 'Approve', icon: 'alert-circle-outline' },
    { label: 'Companies', icon: 'business-outline', action:()=>{router.push('../CompanyList/ExecutiveCompanies')}},
    { label: 'Executives', icon: 'person-outline', action:()=>{router.push('../CompanyList/ExecutiveCompanies')}},
    { label: 'Delete', icon: 'trash-outline', action:()=>{router.push('../Others/Upload')}},
    { label: 'Add', icon: 'person-add-outline', action:()=>{router.push('../(others)/AddMember')}},

  ];
  const router = useRouter()
  return (
    <LinearGradient
      colors={['#f7cce7', '#ffffff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Section */}
        <View style={styles.topBar}>
          <Text style={styles.heading}>Welcome Back 👋</Text>
          <Text style={styles.subheading}>Here's your quick access</Text>
        </View>

        {/* White Card Container */}
        <View style={styles.cardContainer}>
          <View style={styles.grid}>
            {buttons.map((btn, index) => (
              <TouchableOpacity key={index} style={styles.iconWrapper} onPress={btn.action}>
                <Ionicons name={btn.icon} size={32} color="#333" />
                <Text style={[styles.label, index === 0 && styles.bold]}>
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
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
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  subheading: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardContainer: {
    backgroundColor: '#ffffff',
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
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: '#333',
    marginTop: 8,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  bold: {
    fontWeight: 'bold',
  },
});
