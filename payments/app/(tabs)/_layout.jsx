import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TabBarIcon } from '../../components/navigation/TabBarIcon';

import { initializeAuth, logoutUser } from '../../src/store/authSlice';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { Platform, Alert } from 'react-native';

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
  const userRole = user?.role || 'admin';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        headerShown: false,
        headerStyle: {
          backgroundColor: '#f8f9fa',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
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
            <TabBarIcon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} />
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
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />
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
