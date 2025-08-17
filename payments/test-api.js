// Quick test script to verify API connection
const API_BASE_URL = 'http://10.184.177.62:8000';

async function testAPI() {
  console.log('Testing API connection...');

  try {
    // Test health endpoint
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    console.log('Health check:', healthResponse.status, await healthResponse.text());

    // Test login endpoint
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@jaskirat.com',
        password: 'admin123'
      })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('Login successful:', loginData);

      // Test protected endpoint
      const userResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${loginData.access_token}`
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('User data:', userData);
      } else {
        console.log('User endpoint failed:', userResponse.status);
      }
    } else {
      const errorData = await loginResponse.text();
      console.log('Login failed:', loginResponse.status, errorData);
    }
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

testAPI();
