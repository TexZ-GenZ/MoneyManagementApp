// Debug API Connection Script
console.log('🔍 Debug API Connection');

// Test environment variables
console.log('Environment Variables:');
console.log('EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);

// Test API connection
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
console.log('Using API Base URL:', API_BASE_URL);

async function testAPI() {
    try {
        // Test health endpoint
        const healthUrl = API_BASE_URL.replace('/api', '') + '/health';
        console.log('Testing health endpoint:', healthUrl);

        const response = await fetch(healthUrl);
        const data = await response.json();
        console.log('✅ Health check successful:', data);

        // Test login endpoint
        console.log('Testing login endpoint...');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@jaskirat.com',
                password: 'admin123'
            })
        });

        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ Login successful');

            // Test companies endpoint
            const companiesResponse = await fetch(`${API_BASE_URL}/companies/`, {
                headers: {
                    'Authorization': `Bearer ${loginData.access_token}`
                }
            });

            if (companiesResponse.ok) {
                const companies = await companiesResponse.json();
                console.log('✅ Companies fetched:', companies.length, 'companies');
                console.log('Sample company:', companies[0]);
            } else {
                console.error('❌ Companies fetch failed:', companiesResponse.status);
            }
        } else {
            console.error('❌ Login failed:', loginResponse.status);
        }

    } catch (error) {
        console.error('❌ API Error:', error.message);
    }
}

testAPI();
