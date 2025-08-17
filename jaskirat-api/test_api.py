import asyncio
import httpx
import json
from datetime import datetime


async def test_api_endpoints():
    """Test the Jaskirat Textiles API endpoints"""
    base_url = "http://localhost:8000"

    async with httpx.AsyncClient() as client:
        print("🧪 Testing Jaskirat Textiles API")
        print("=" * 50)

        # Test 1: Health Check
        print("\n1. Health Check")
        try:
            response = await client.get(f"{base_url}/health")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
        except Exception as e:
            print(f"   Error: {e}")

        # Test 2: API Info
        print("\n2. API Info")
        try:
            response = await client.get(f"{base_url}/")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
        except Exception as e:
            print(f"   Error: {e}")

        # Test 3: Login as Admin
        print("\n3. Admin Login")
        login_data = {"email": "admin@jaskirat.com", "password": "admin123"}

        try:
            response = await client.post(f"{base_url}/api/auth/login", json=login_data)
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                auth_data = response.json()
                access_token = auth_data["access_token"]
                user_info = auth_data["user"]
                print(f"   User: {user_info['name']} ({user_info['role']})")
                print(f"   Token: {access_token[:20]}...")

                # Set authorization header for subsequent requests
                headers = {"Authorization": f"Bearer {access_token}"}

                # Test 4: Get Current User Info
                print("\n4. Get Current User Info")
                response = await client.get(f"{base_url}/api/auth/me", headers=headers)
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    print(f"   User: {response.json()}")

                # Test 5: Get All Users
                print("\n5. Get All Users")
                response = await client.get(f"{base_url}/api/users", headers=headers)
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    users = response.json()
                    print(f"   Found {len(users)} users")
                    for user in users:
                        print(f"   - {user['name']} ({user['email']}) - {user['role']}")

                # Test 6: Get All Companies
                print("\n6. Get All Companies")
                response = await client.get(
                    f"{base_url}/api/companies", headers=headers
                )
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    companies = response.json()
                    print(f"   Found {len(companies)} companies")
                    for company in companies:
                        print(f"   - {company['name']} ({company['contact_person']})")

                # Test 7: Get All Bills
                print("\n7. Get All Bills")
                response = await client.get(f"{base_url}/api/bills", headers=headers)
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    bills = response.json()
                    print(f"   Found {len(bills)} bills")
                    for bill in bills:
                        print(
                            f"   - {bill['bill_number']}: ${bill['amount']} ({bill['status']})"
                        )

                # Test 8: Get All Payments
                print("\n8. Get All Payments")
                response = await client.get(f"{base_url}/api/payments", headers=headers)
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    payments = response.json()
                    print(f"   Found {len(payments)} payments")

                # Test 9: Get Notifications
                print("\n9. Get Notifications")
                response = await client.get(
                    f"{base_url}/api/notifications", headers=headers
                )
                print(f"   Status: {response.status_code}")
                if response.status_code == 200:
                    notifications = response.json()
                    print(f"   Found {len(notifications)} notifications")

                # Test 10: Test Executive Login
                print("\n10. Executive Login")
                exec_login_data = {
                    "email": "executive@jaskirat.com",
                    "password": "exec123",
                }
                response = await client.post(
                    f"{base_url}/api/auth/login", json=exec_login_data
                )
                print(f"    Status: {response.status_code}")
                if response.status_code == 200:
                    exec_auth = response.json()
                    exec_headers = {
                        "Authorization": f"Bearer {exec_auth['access_token']}"
                    }
                    print(f"    Executive: {exec_auth['user']['name']}")

                    # Test executive permissions
                    response = await client.get(
                        f"{base_url}/api/payments", headers=exec_headers
                    )
                    print(
                        f"    Executive can view payments: {response.status_code == 200}"
                    )

            else:
                print(f"   Error: {response.text}")

        except Exception as e:
            print(f"   Error: {e}")

        print("\n" + "=" * 50)
        print("✅ API Testing Complete!")
        print(f"📖 Full API Documentation: {base_url}/docs")


if __name__ == "__main__":
    asyncio.run(test_api_endpoints())
