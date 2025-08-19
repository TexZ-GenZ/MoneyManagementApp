import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TabBarIcon } from '../../components/navigation/TabBarIcon';
import { useAppSelector, useAppDispatch } from '../../src/store/hooks';
import { logoutUser } from '../../src/store/authSlice';
import { Platform, Alert } from 'react-native';

export default function TabLayout() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // useEffect(() => {
  //   // Authentication is handled in the root layout
  //   // Just redirect to login if not authenticated
  //   if (!isAuthenticated && !isLoading) {
  //     router.replace('/login');
  //   }
  // }, [isAuthenticated, isLoading, router]);

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

  // if (!isAuthenticated) {
  //   return null; // Will redirect to login
  // }

  // Get user role for conditional tab rendering
  const userRole = user?.role || 'executive';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        headerShown: true,
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

      {/* Dashboard - Available to all roles
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
          headerTitle: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard`,
        }}
      /> */}

      {/* Executive Navigation */}
      {userRole === 'executive' && (
        <>
          <Tabs.Screen
            name="Home"
            options={{
              title: '../../src/screens/executive/DashboardScreen',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'business' : 'business-outline'} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="payments"
            options={{
              title: 'Payments',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'card' : 'card-outline'} color={color} />
              ),
            }}
          />
        </>
      )}

      {/* Accountant Navigation */}
      {userRole === 'accountant' && (
        <>
          <Tabs.Screen
            name="explore"
            options={{
              title: 'Executives',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="payments"
            options={{
              title: 'Approvals',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} color={color} />
              ),
            }}
          />
        </>
      )}

      {/* Admin Navigation */}
      {userRole === 'admin' && (
        <>
          <Tabs.Screen
            name="admin"
            options={{
              title: 'Users',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="payments"
            options={{
              title: 'Approvals',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="reports"
            options={{
              title: 'Reports',
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} />
              ),
            }}
          />
        </>
      )}

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
