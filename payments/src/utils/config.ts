/**
 * Environment Configuration Helper
 * Provides utilities for managing different environments and API configurations
 */

import { API_BASE_URL, DEBUG_MODE, ENVIRONMENT } from './constants';

export const config = {
  api: {
    baseURL: API_BASE_URL,
    timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000'),
    retryAttempts: parseInt(process.env.EXPO_PUBLIC_RETRY_ATTEMPTS || '3'),
  },
  app: {
    name: process.env.EXPO_PUBLIC_APP_NAME || 'Jaskirat Textiles',
    version: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
    environment: ENVIRONMENT,
    debugMode: DEBUG_MODE,
  },
  features: {
    enableNotifications: process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS === 'true',
    enableLocationTracking: process.env.EXPO_PUBLIC_ENABLE_LOCATION_TRACKING === 'true',
    enableOfflineMode: process.env.EXPO_PUBLIC_ENABLE_OFFLINE_MODE === 'true',
  },
};

// Environment checks
export const isDevelopment = ENVIRONMENT === 'development';
export const isProduction = ENVIRONMENT === 'production';
export const isStaging = ENVIRONMENT === 'staging';

// API URL helpers
export const getApiUrl = (endpoint: string = '') => {
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Log configuration in development
if (isDevelopment && DEBUG_MODE) {
  console.log('🔧 Environment Configuration:', {
    environment: ENVIRONMENT,
    apiBaseURL: API_BASE_URL,
    debugMode: DEBUG_MODE,
    features: config.features,
  });
}

export default config;
