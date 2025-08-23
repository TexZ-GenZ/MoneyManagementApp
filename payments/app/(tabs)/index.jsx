import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAppSelector } from '../../src/store/hooks';

export default function Index() {
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/login" />;
  }

  const role = user.role;

  if (role === 'admin') return <Redirect href="/AdminDashboard" />;
  if (role === 'executive') return <Redirect href="/executiveDashboard" />;
  if (role === 'accountant') return <Redirect href="/AccountantDashboard" />;

  return <Redirect href="/login" />;
}
