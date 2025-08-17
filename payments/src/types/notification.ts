export interface Notification {
  id: string;
  type: 'promise_date_crossed' | 'payment_received' | 'system_alert';
  title: string;
  message: string;
  companyCode?: string;
  companyName?: string;
  paymentId?: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  userId: string;
  userRole: 'admin' | 'accountant' | 'executive';
  createdAt: string;
  readAt?: string;
}

export interface SystemSettings {
  creditDayBuffer: number; // Days to add to oldest bill for credit date
  notificationFrequencyHours: number; // How often to send notifications
  autoLogoutMinutes: number;
  maxBillsPerPayment: number;
}
