// App constants
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Jaskirat Textiles';
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0';

// API endpoints - Now using environment variable
// export const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI || 'http://localhost:8000/api';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

// Debug mode
export const DEBUG_MODE = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true';

// Environment type
export const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  EXECUTIVE: 'executive'
} as const;

// Payment methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CHEQUE: 'cheque',
  ONLINE: 'online',
  CARD: 'card'
} as const;

// Bill status
export const BILL_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial'
} as const;

// Payment status
export const PAYMENT_STATUS = {
  SUBMITTED: 'submitted',
  ACCOUNTANT_APPROVED: 'accountant_approved',
  ACCOUNTANT_DECLINED: 'accountant_declined',
  ADMIN_APPROVED: 'admin_approved',
  ADMIN_DECLINED: 'admin_declined'
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  PROMISE_DATE_CROSSED: 'promise_date_crossed',
  PAYMENT_RECEIVED: 'payment_received',
  SYSTEM_ALERT: 'system_alert'
} as const;

// Colors
export const COLORS = {
  PRIMARY: '#2E86AB',
  SECONDARY: '#A23B72',
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#2196F3',
  LIGHT: '#F5F5F5',
  DARK: '#212121',
  WHITE: '#FFFFFF',
  GRAY: '#9E9E9E',
  
  // Additional UI colors
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  shadow: '#000000',
  primary: '#2E86AB'
} as const;

// Screen names
export const SCREENS = {
  // Auth
  LOGIN: 'Login',
  
  // Executive
  EXECUTIVE_DASHBOARD: 'ExecutiveDashboard',
  COMPANY_DETAILS: 'CompanyDetails',
  PAYMENT_COLLECTION: 'PaymentCollection',
  
  // Accountant
  ACCOUNTANT_DASHBOARD: 'AccountantDashboard',
  PAYMENT_APPROVAL: 'PaymentApproval',
  PENDING_BILLS: 'PendingBills',
  PAID_BILLS: 'PaidBills',
  
  // Admin
  ADMIN_DASHBOARD: 'AdminDashboard',
  ADMIN_PAYMENT_APPROVAL: 'AdminPaymentApproval',
  USER_MANAGEMENT: 'UserManagement',
  SETTINGS: 'Settings'
} as const;

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  SETTINGS: 'app_settings'
} as const;

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  API: 'YYYY-MM-DD',
  DATETIME: 'DD/MM/YYYY HH:mm'
} as const;
