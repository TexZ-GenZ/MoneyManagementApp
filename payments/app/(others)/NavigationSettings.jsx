import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

export default function NavigationSettings() {
  const router = useRouter();

  const navItems = [
    { label: 'Executive wise company info', icon: 'people-outline', route: '../(others)/ExecutiveList' },
    { label: 'User info management', icon: 'person-circle-outline', route: '../(others)/ManageUsers' },
    { label: 'Modify company assignments', icon: 'git-branch-outline', route: '../(others)/CompanyAssignments' },
    { label: 'Companies list', icon: 'business-outline', route: '../CompanyList/AllCompanies' },
  ];

  const onPressItem = (item) => {
    router.push(item.route);
  };

  const renderNavItem = ({ item }) => (
    <TouchableOpacity
      key={item.label}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={styles.navItem}
      onPress={() => onPressItem(item)}
      activeOpacity={0.85}
    >
      <View style={styles.navIconWrap}>
        <Ionicons name={item.icon} size={24} color="#000" />
      </View>
      <Text style={styles.navLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={tokens.colors.textDim} />
    </TouchableOpacity>
  );

  return (
    <Screen
      title="Navigation Settings"
      scroll
      backButton
    >
      <Card style={styles.navCard}>
        <FlatList
          data={navItems}
          keyExtractor={i => i.label}
          renderItem={renderNavItem}
          scrollEnabled={false}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  navCard: { paddingVertical: 8, paddingHorizontal: 0 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  navIconWrap: {
    backgroundColor: tokens.colors.accent,
    padding: 12,
    borderRadius: 30,
    marginRight: 16,
  },
  navLabel: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
