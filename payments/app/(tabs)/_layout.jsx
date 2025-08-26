import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TabBarIcon } from '../../components/navigation/TabBarIcon';

import { initializeAuth, logoutUser } from '../../src/store/authSlice';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { Platform, Alert, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

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
  // Use a sensible default when inset is 0 (common on Android with 3-button nav)
  const DEFAULT_BOTTOM_PADDING_IOS = 12;
  const DEFAULT_BOTTOM_PADDING_ANDROID = 20;
  // Clamp to avoid over-inflation on gesture devices but never drop below defaults
  const bottomInsetIOS = Math.min((insets.bottom && insets.bottom > 0 ? insets.bottom : DEFAULT_BOTTOM_PADDING_IOS), 24);
  const bottomInsetAndroid = Math.min((insets.bottom && insets.bottom > 0 ? insets.bottom : DEFAULT_BOTTOM_PADDING_ANDROID), 28);
  // Add a tiny symmetric padding to look balanced above & below the icons
  const EXTRA_BAR_PADDING = 8;

  const baseTabBarStyle = Platform.select({
    ios: {
      backgroundColor: '#27323d',
      borderTopColor: '#364350',
      paddingTop: EXTRA_BAR_PADDING,
      // Respect safe area without adding excessive extra padding
      paddingBottom: bottomInsetIOS + EXTRA_BAR_PADDING,
      height: 56 + bottomInsetIOS + EXTRA_BAR_PADDING,
    },
    default: {
      backgroundColor: '#27323d',
      borderTopColor: '#364350',
      elevation: 20,
      paddingTop: EXTRA_BAR_PADDING,
      // Ensure we sit above the on-screen nav even when inset is reported as 0
      paddingBottom: bottomInsetAndroid + EXTRA_BAR_PADDING,
      height: 60 + bottomInsetAndroid + EXTRA_BAR_PADDING,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: -2 },
      shadowRadius: 10,
    },
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#9fdf56',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        headerShown: false,
        // Avoid covering inputs; hide the bar when keyboard shows
        tabBarHideOnKeyboard: true,
        headerStyle: { backgroundColor: '#1f2933' },
        headerTitleStyle: {
          fontWeight: '600',
          color: '#ffffff'
        },
        // Ensure consistent Android ripple splash color on all tabs
        tabBarButton: (props) => {
          const { children, style, ...rest } = props;
          return (
            <Pressable
              android_ripple={{ color: 'rgba(159,223,86,0.25)', borderless: false }}
              style={style}
              {...rest}
            >
              {children}
            </Pressable>
          );
        },
        // tabBarItemStyle: {
        //   paddingVertical: 6,
        //   justifyContent: 'center',
        //   alignItems: 'center',
        //   minHeight: 52,
        //   flex: 1,
        // },
        // tabBarLabelStyle: {
        //   fontSize: 12,
        //   fontWeight: '700',
        //   marginTop: 2,
        //   marginBottom: 2,
        // },
        // tabBarIconStyle: {
        //   marginTop: 0,
        //   alignItems: 'center',
        //   justifyContent: 'center'
        // },
        tabBarStyle: baseTabBarStyle,
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
          // tabBarLabel: ({ color }) => (
          //   <Text style={{ color, fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'center' }}>Admin Dashboard</Text>
          // ),
        }}
      />

      {/* History tab for admin - positioned before settings */}
      <Tabs.Screen
        name="UnifiedHistory"
        options={{
          title: 'History',
          href: userRole === 'admin' ? '/(tabs)/UnifiedHistory' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'time' : 'time-outline'} color={color} />
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

      {/* History tab for accountant and executive - positioned last */}
      <Tabs.Screen
        name="History"
        options={{
          title: 'History',
          href: (userRole === 'accountant' || userRole === 'executive') ? '/(tabs)/History' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'time' : 'time-outline'} color={color} />
          ),
        }}
      />

      {/* Profile/Settings - Available to all roles */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={26}
            ></TabBarIcon>
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