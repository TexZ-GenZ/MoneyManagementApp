// Navigation container is provided by expo-router; don't render a second NavigationContainer here.
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { useColorScheme } from 'react-native';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import {store} from "../src/store"
import { initializeAuth } from '../src/store/authSlice';

function AppContent() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize authentication when app starts
    store.dispatch(initializeAuth());
  }, []);

  // Do not render a NavigationContainer here — expo-router provides the root container.
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
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
