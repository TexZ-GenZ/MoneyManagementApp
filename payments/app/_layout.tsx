// Navigation container is provided by expo-router; don't render a second NavigationContainer here.
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { useColorScheme } from 'react-native';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import 'react-native-reanimated';

import { store } from "../src/store"
import { initializeAuth } from '../src/store/authSlice';

function AppContent() {
  const colorScheme = useColorScheme();

  // Configure Android channel once
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 240, 120, 240],
        lightColor: '#2E86AB',
        // sound can be added if custom file included: sound: 'custom.wav'
      }).catch(() => { });
    }
  }, []);


  useEffect(() => {
    // Initialize authentication when app starts
    store.dispatch(initializeAuth());
  }, []);

  // Do not render a NavigationContainer here — expo-router provides the root container.
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}
