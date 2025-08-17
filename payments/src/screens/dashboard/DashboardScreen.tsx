import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSelector } from '../../store/hooks';
import Button from '../../components/common/Button';
import { COLORS, APP_NAME } from '../../utils/constants';

const { width } = Dimensions.get('window');

const DashboardScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const userRole = user?.role || 'executive';

  const renderRoleSpecificContent = () => {
    switch (userRole) {
      case 'admin':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Dashboard</Text>
            <Text style={styles.sectionDescription}>
              Manage users, view all reports, and configure system settings.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                title="Final Approval"
                onPress={() => router.push('/approval-queue')}
                style={styles.actionButton}
              />
              <Button
                title="System Settings"
                onPress={() => {/* Navigate to settings */ }}
                style={styles.actionButton}
                variant="outline"
              />
            </View>
          </View>
        );

      case 'accountant':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accountant Dashboard</Text>
            <Text style={styles.sectionDescription}>
              Review payments, generate reports, and manage financial data.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                title="Payment Approvals"
                onPress={() => router.push('/approval-queue')}
                style={styles.actionButton}
              />
              <Button
                title="Generate Reports"
                onPress={() => {/* Navigate to reports */ }}
                style={styles.actionButton}
                variant="outline"
              />
            </View>
          </View>
        );

      default: // executive
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Dashboard</Text>
            <Text style={styles.sectionDescription}>
              Collect payments, view recent transactions, and manage customer data.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                title="Payment History"
                onPress={() => router.push('/payment-history')}
                style={styles.actionButton}
              />
              <Button
                title="Customer List"
                onPress={() => {/* Navigate to customers */ }}
                style={styles.actionButton}
                variant="outline"
              />
            </View>
          </View>
        );
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {getGreeting()}, {user?.firstName || 'User'}!
          </Text>
          <Text style={styles.companyName}>{APP_NAME}</Text>
          <Text style={styles.role}>{userRole.toUpperCase()} DASHBOARD</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹1,24,500</Text>
            <Text style={styles.statLabel}>Today's Collection</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>47</Text>
            <Text style={styles.statLabel}>Pending Payments</Text>
          </View>
        </View>

        {/* Role-specific content */}
        {renderRoleSpecificContent()}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>Payment received from ABC Industries</Text>
            <Text style={styles.activityTime}>2 hours ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>New invoice created for XYZ Corp</Text>
            <Text style={styles.activityTime}>4 hours ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>Payment reminder sent to DEF Ltd</Text>
            <Text style={styles.activityTime}>1 day ago</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  companyName: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 5,
  },
  role: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 10,
  },
});

export default DashboardScreen;
