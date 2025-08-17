// Simple test to verify backend connection
import { config } from '../utils/config';

export const testBackendConnection = async () => {
  try {
    console.log('🔍 Testing backend connection...');
    console.log('📡 API Base URL:', config.api.baseURL);

    // Test health endpoint
    const healthResponse = await fetch(`${config.api.baseURL.replace('/api', '')}/health`);
    const healthData = await healthResponse.json();

    console.log('✅ Health check successful:', healthData);

    // Test API info endpoint
    const infoResponse = await fetch(`${config.api.baseURL.replace('/api', '')}/`);
    const infoData = await infoResponse.json();

    console.log('✅ API info successful:', infoData);

    return {
      success: true,
      health: healthData,
      info: infoData
    };

  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const testLogin = async () => {
  try {
    console.log('🔐 Testing login with demo credentials...');

    const loginResponse = await fetch(`${config.api.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@jaskirat.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful:', {
      user: loginData.user.name,
      role: loginData.user.role,
      token: loginData.access_token.substring(0, 20) + '...'
    });

    return {
      success: true,
      data: loginData
    };

  } catch (error) {
    console.error('❌ Login test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export default {
  testBackendConnection,
  testLogin
};
