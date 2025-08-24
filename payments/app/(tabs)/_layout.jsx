import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TabBarIcon } from '../../components/navigation/TabBarIcon';

import { initializeAuth, logoutUser } from '../../src/store/authSlice';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { Platform, Alert, Text } from 'react-native';

export default function TabLayout() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth
  );

  // Initialize auth on mount
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            dispatch(logoutUser());
            router.replace('/login');
          },
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  // Get user role for conditional tab rendering
  const userRole = user?.role || 'accountant';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c8f14c',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        headerShown: false,
        headerStyle: {
          backgroundColor: '#f8f9fa',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarItemStyle: { paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
        tabBarIconStyle: { marginTop: 0 },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: '#000',
            borderTopColor: 'transparent',
            height: 82,
            paddingTop: 10,
            paddingBottom: 18,
          },
          default: {
            backgroundColor: '#000',
            borderTopColor: 'transparent',
            elevation: 20,
            height: 95,
            paddingTop: 10,
            paddingBottom: 18,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 12,
          },
        }),
      }}>

      <Tabs.Screen name="index" options={{ href: null }} />

      {/* Conditionally display dashboard tabs based on user role */}
      <Tabs.Screen
        name="AdminDashboard"
        options={{
          title: 'Admin Dashboard',
          href: userRole === 'admin' ? '/AdminDashboard' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} style={{ transform: [{ translateY: -6 }] }} />
          ),
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 12, fontWeight: '600', marginTop: 0, transform: [{ translateY: -4 }] }}>Admin Dashboard</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="executiveDashboard"
        options={{
          title: 'Dashboard',
          href: userRole === 'executive' ? '/executiveDashboard' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'business' : 'business-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="AccountantDashboard"
        options={{
          title: 'Accountant Dashboard',
          href: userRole === 'accountant' ? '/AccountantDashboard' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'calculator' : 'calculator-outline'} color={color} />
          ),
        }}
      />

      {/* Profile/Settings - Available to all roles */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} style={{ transform: [{ translateY: -18 }] }} />
          ),
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 12, fontWeight: '600', marginTop: 0, transform: [{ translateY: -16 }] }}>Profile</Text>
          ),
          headerRight: () => (
            <TabBarIcon
              name="log-out-outline"
              color="#FF3B30"
              style={{ marginRight: 15 }}
              onPress={handleLogout}
            />
          ),
        }}
      />
    </Tabs>
  );
}
