import React, { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';

// This is a mock function. Replace this with your actual logic to get the user's role.
// For example, you might fetch it from AsyncStorage or from an API.
const getUserRole = async () => {
  // For demonstration purposes, we'll return 'admin'.
  // In a real app, you would have a single, determined role from your auth state.
  return 'admin'; // Can be 'admin', 'executive', or 'accountant'
};

export default function Index() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const userRole = await getUserRole();
        setRole(userRole);
      } catch (error) {
        // Handle error, maybe redirect to a login or error screen
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (role === 'admin') {
    return <Redirect href="/AdminDashboard" />;
  }

  if (role === 'executive') {
    return <Redirect href="/executiveDashboard" />;
  }

  if (role === 'accountant') {
    return <Redirect href="/AccountantDashboard" />;
  }

  // Fallback to a default screen or login if role is not found or invalid
  // Assuming you have a login screen at /login
  return <Redirect href="/login" />;
}
