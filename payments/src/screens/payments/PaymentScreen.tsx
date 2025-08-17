import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAppSelector } from '../../store/hooks';
import Button from '../../components/common/Button';
import { COLORS } from '../../utils/constants';

const PaymentScreen: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const userRole = user?.role || 'executive';

  const renderPaymentContent = () => {
    switch (userRole) {
      case 'admin':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Administration</Text>
            <Text style={styles.sectionDescription}>
              Oversee all payment activities and approve high-value transactions.
            </Text>
            <Button
              title="Approve Pending Payments"
              onPress={() => {/* Navigate to admin approval */ }}
              style={styles.actionButton}
            />
          </View>
        );

      case 'accountant':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Review</Text>
            <Text style={styles.sectionDescription}>
              Review and approve payments submitted by executives.
            </Text>
            <Button
              title="Review Pending Payments"
              onPress={() => {/* Navigate to payment review */ }}
              style={styles.actionButton}
            />
          </View>
        );

      default: // executive
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collect Payments</Text>
            <Text style={styles.sectionDescription}>
              Record new payments from customers and manage payment records.
            </Text>
            <Button
              title="New Payment Entry"
              onPress={() => {/* Navigate to payment entry */ }}
              style={styles.actionButton}
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>Manage payment collection and processing</Text>
        </View>

        {/* Role-specific content */}
        {renderPaymentContent()}

        {/* Recent Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>

          <View style={styles.paymentItem}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentCompany}>ABC Industries</Text>
              <Text style={styles.paymentDate}>08 Aug 2025</Text>
            </View>
            <View style={styles.paymentAmount}>
              <Text style={styles.amountText}>₹45,000</Text>
              <Text style={styles.statusText}>Approved</Text>
            </View>
          </View>

          <View style={styles.paymentItem}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentCompany}>XYZ Corporation</Text>
              <Text style={styles.paymentDate}>07 Aug 2025</Text>
            </View>
            <View style={styles.paymentAmount}>
              <Text style={styles.amountText}>₹28,500</Text>
              <Text style={styles.statusPending}>Pending</Text>
            </View>
          </View>

          <View style={styles.paymentItem}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentCompany}>DEF Limited</Text>
              <Text style={styles.paymentDate}>06 Aug 2025</Text>
            </View>
            <View style={styles.paymentAmount}>
              <Text style={styles.amountText}>₹67,200</Text>
              <Text style={styles.statusText}>Approved</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Search Payments"
              onPress={() => {/* Navigate to search */ }}
              style={styles.quickButton}
              variant="outline"
            />
            <Button
              title="Export Data"
              onPress={() => {/* Export functionality */ }}
              style={styles.quickButton}
              variant="outline"
            />
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
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
  actionButton: {
    marginBottom: 10,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentCompany: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.SUCCESS,
  },
  statusPending: {
    fontSize: 12,
    color: COLORS.WARNING,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickButton: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default PaymentScreen;
