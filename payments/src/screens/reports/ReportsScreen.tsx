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

const ReportsScreen: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reports & Analytics</Text>
          <Text style={styles.subtitle}>Generate detailed reports and insights</Text>
        </View>

        {/* Report Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Reports</Text>

          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Daily Collection Summary</Text>
            <Text style={styles.reportDescription}>Overview of daily payment collections</Text>
            <Button
              title="Generate Report"
              onPress={() => {/* Generate daily report */ }}
              style={styles.reportButton}
              variant="outline"
            />
          </View>

          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Monthly Revenue Analysis</Text>
            <Text style={styles.reportDescription}>Detailed monthly revenue breakdown</Text>
            <Button
              title="Generate Report"
              onPress={() => {/* Generate monthly report */ }}
              style={styles.reportButton}
              variant="outline"
            />
          </View>

          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Outstanding Payments</Text>
            <Text style={styles.reportDescription}>List of pending and overdue payments</Text>
            <Button
              title="Generate Report"
              onPress={() => {/* Generate outstanding report */ }}
              style={styles.reportButton}
              variant="outline"
            />
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Statistics</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>₹2,45,600</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>156</Text>
              <Text style={styles.statLabel}>Total Transactions</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>₹45,200</Text>
              <Text style={styles.statLabel}>Pending Amount</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>23</Text>
              <Text style={styles.statLabel}>Overdue Bills</Text>
            </View>
          </View>
        </View>

        {/* Export Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Options</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Export to Excel"
              onPress={() => {/* Export to Excel */ }}
              style={styles.exportButton}
            />
            <Button
              title="Export to PDF"
              onPress={() => {/* Export to PDF */ }}
              style={styles.exportButton}
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
    marginBottom: 15,
  },
  reportCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 5,
  },
  reportDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 15,
    lineHeight: 20,
  },
  reportButton: {
    alignSelf: 'flex-start',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exportButton: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default ReportsScreen;
