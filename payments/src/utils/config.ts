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
  const rawBase = API_BASE_URL || '';
  const baseUrl = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
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

// Production safety guard: warn if debug accidentally enabled
if (isProduction && DEBUG_MODE) {
  // Single warning; keeps bundle lightweight without throwing
  // eslint-disable-next-line no-console
  console.warn('DEBUG_MODE is enabled while ENVIRONMENT=production. Disable it in eas.json env for production builds.');
}

export default config;
