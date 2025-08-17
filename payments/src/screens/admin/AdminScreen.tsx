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

const AdminScreen: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Administration</Text>
          <Text style={styles.subtitle}>System management and configuration</Text>
        </View>

        {/* User Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Management</Text>

          <View style={styles.adminCard}>
            <Text style={styles.cardTitle}>Manage Users</Text>
            <Text style={styles.cardDescription}>Add, edit, or deactivate user accounts</Text>
            <Button
              title="User Management"
              onPress={() => {/* Navigate to user management */ }}
              style={styles.cardButton}
            />
          </View>

          <View style={styles.adminCard}>
            <Text style={styles.cardTitle}>Role Permissions</Text>
            <Text style={styles.cardDescription}>Configure user roles and permissions</Text>
            <Button
              title="Manage Permissions"
              onPress={() => {/* Navigate to permissions */ }}
              style={styles.cardButton}
              variant="outline"
            />
          </View>
        </View>

        {/* System Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Settings</Text>

          <View style={styles.adminCard}>
            <Text style={styles.cardTitle}>Company Settings</Text>
            <Text style={styles.cardDescription}>Update company information and preferences</Text>
            <Button
              title="Company Settings"
              onPress={() => {/* Navigate to company settings */ }}
              style={styles.cardButton}
              variant="outline"
            />
          </View>

          <View style={styles.adminCard}>
            <Text style={styles.cardTitle}>Payment Configuration</Text>
            <Text style={styles.cardDescription}>Configure payment methods and limits</Text>
            <Button
              title="Payment Config"
              onPress={() => {/* Navigate to payment config */ }}
              style={styles.cardButton}
              variant="outline"
            />
          </View>
        </View>

        {/* System Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>

          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Active Users</Text>
              <Text style={styles.statusValue}>12</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>System Health</Text>
              <Text style={[styles.statusValue, { color: COLORS.SUCCESS }]}>Good</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Database Size</Text>
              <Text style={styles.statusValue}>2.3 GB</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Last Backup</Text>
              <Text style={styles.statusValue}>Today</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Backup Data"
              onPress={() => {/* Backup data */ }}
              style={styles.quickButton}
            />
            <Button
              title="System Logs"
              onPress={() => {/* View logs */ }}
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
    marginBottom: 15,
  },
  adminCard: {
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 15,
    lineHeight: 20,
  },
  cardButton: {
    alignSelf: 'flex-start',
  },
  statusContainer: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
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

export default AdminScreen;
