import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';

const AccountantDashboardScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accountant Dashboard</Text>
      <Text style={styles.subtitle}>Payment Approval & Management</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Pending Approvals</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹85,000</Text>
          <Text style={styles.statLabel}>Today's Approved</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>25</Text>
          <Text style={styles.statLabel}>Overdue Bills</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>156</Text>
          <Text style={styles.statLabel}>Total Companies</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.LIGHT,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.GRAY,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: 'center',
  },
});

export default AccountantDashboardScreen;
