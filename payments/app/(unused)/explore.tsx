import React from 'react';
import { useAppSelector } from '../../src/store/hooks';
import CompaniesScreen from '../../src/screens/companies/CompaniesScreen';
import ExecutivesScreen from '../../src/screens/accountant/ExecutivesScreen';

export default function ExploreTab() {
  const { user } = useAppSelector((state) => state.auth);

  // Route to appropriate screen based on user role
  if (user?.role === 'accountant') {
    return <ExecutivesScreen />;
  }

  // Default to companies screen for executives and admins
  return <CompaniesScreen />;
}
