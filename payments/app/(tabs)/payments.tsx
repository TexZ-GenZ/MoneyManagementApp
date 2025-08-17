import React from 'react';
import { useAppSelector } from '../../src/store/hooks';
import PaymentScreen from '../../src/screens/payments/PaymentScreen';
import ApprovalQueueScreen from '../../src/screens/approvals/ApprovalQueueScreen';

export default function PaymentsTab() {
  const { user } = useAppSelector((state) => state.auth);

  // Route to appropriate screen based on user role
  if (user?.role === 'accountant' || user?.role === 'admin') {
    return <ApprovalQueueScreen />;
  }

  // Default to payment screen for executives
  return <PaymentScreen />;
}
