#!/usr/bin/env python3
"""
Fintech Dashboard Backend API Testing
Tests all endpoints including auth, transactions, budgets, stocks, alerts, and exports
"""

import requests
import sys
import json
import subprocess
from datetime import datetime, timezone, timedelta

class FintechAPITester:
    def __init__(self, base_url="https://money-hub-72.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", endpoint=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "endpoint": endpoint
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details, endpoint)
            
            if success:
                try:
                    return response.json()
                except:
                    return response.text
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}", endpoint)
            return None

    def create_test_user_session(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Creating test user and session...")
        
        timestamp = int(datetime.now().timestamp())
        user_id = f"test-user-{timestamp}"
        session_token = f"test_session_{timestamp}"
        
        mongo_script = f"""
use('test_database');
var userId = '{user_id}';
var sessionToken = '{session_token}';
db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{timestamp}@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"""
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                self.session_token = session_token
                self.user_id = user_id
                print(f"✅ Test user created: {user_id}")
                print(f"✅ Session token: {session_token}")
                return True
            else:
                print(f"❌ Failed to create test user: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating test user: {e}")
            return False

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🏥 Testing Health Endpoints...")
        
        # Test root endpoint
        self.run_test("API Root", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_stock_endpoints(self):
        """Test stock data endpoints"""
        print("\n📈 Testing Stock Endpoints...")
        
        # Test stocks endpoint (should work without auth)
        result = self.run_test("Get Stock Data", "GET", "stocks", 200)
        
        if result:
            if isinstance(result, list) and len(result) > 0:
                stock = result[0]
                required_fields = ['symbol', 'name', 'price', 'change', 'change_percent']
                if all(field in stock for field in required_fields):
                    self.log_test("Stock Data Structure", True, "All required fields present")
                else:
                    self.log_test("Stock Data Structure", False, f"Missing fields in stock data")
            else:
                self.log_test("Stock Data Content", False, "No stock data returned")

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Auth Endpoints...")
        
        if not self.session_token:
            self.log_test("Auth Test Setup", False, "No session token available")
            return
        
        # Test /auth/me endpoint
        result = self.run_test("Get Current User", "GET", "auth/me", 200)
        
        if result:
            required_fields = ['user_id', 'email', 'name']
            if all(field in result for field in required_fields):
                self.log_test("User Data Structure", True, "All required fields present")
            else:
                self.log_test("User Data Structure", False, "Missing required user fields")

    def test_dashboard_endpoints(self):
        """Test dashboard statistics"""
        print("\n📊 Testing Dashboard Endpoints...")
        
        if not self.session_token:
            self.log_test("Dashboard Test Setup", False, "No session token available")
            return
        
        result = self.run_test("Get Dashboard Stats", "GET", "dashboard/stats", 200)
        
        if result:
            required_fields = ['balance', 'total_income', 'total_expense', 'monthly_income', 'monthly_expense']
            if all(field in result for field in required_fields):
                self.log_test("Dashboard Stats Structure", True, "All required fields present")
            else:
                self.log_test("Dashboard Stats Structure", False, "Missing required stats fields")

    def test_transaction_endpoints(self):
        """Test transaction CRUD operations"""
        print("\n💰 Testing Transaction Endpoints...")
        
        if not self.session_token:
            self.log_test("Transaction Test Setup", False, "No session token available")
            return
        
        # Test GET transactions
        transactions = self.run_test("Get Transactions", "GET", "transactions", 200)
        
        # Test POST transaction
        test_transaction = {
            "type": "expense",
            "category": "Food & Dining",
            "amount": 500,
            "description": "Test transaction",
            "date": datetime.now(timezone.utc).isoformat()
        }
        
        created_txn = self.run_test("Create Transaction", "POST", "transactions", 200, test_transaction)
        
        if created_txn and 'transaction_id' in created_txn:
            txn_id = created_txn['transaction_id']
            self.log_test("Transaction Creation Response", True, f"Created transaction {txn_id}")
            
            # Test DELETE transaction
            self.run_test("Delete Transaction", "DELETE", f"transactions/{txn_id}", 200)
        else:
            self.log_test("Transaction Creation Response", False, "No transaction_id in response")

    def test_budget_endpoints(self):
        """Test budget CRUD operations"""
        print("\n🏦 Testing Budget Endpoints...")
        
        if not self.session_token:
            self.log_test("Budget Test Setup", False, "No session token available")
            return
        
        # Test GET budgets
        budgets = self.run_test("Get Budgets", "GET", "budgets", 200)
        
        # Test POST budget
        test_budget = {
            "category": "Test Category",
            "limit": 5000,
            "period": "monthly"
        }
        
        created_budget = self.run_test("Create Budget", "POST", "budgets", 200, test_budget)
        
        if created_budget and 'budget_id' in created_budget:
            budget_id = created_budget['budget_id']
            self.log_test("Budget Creation Response", True, f"Created budget {budget_id}")
            
            # Test DELETE budget
            self.run_test("Delete Budget", "DELETE", f"budgets/{budget_id}", 200)
        else:
            self.log_test("Budget Creation Response", False, "No budget_id in response")

    def test_alert_endpoints(self):
        """Test alert endpoints"""
        print("\n🔔 Testing Alert Endpoints...")
        
        if not self.session_token:
            self.log_test("Alert Test Setup", False, "No session token available")
            return
        
        # Test GET alerts
        alerts = self.run_test("Get Alerts", "GET", "alerts", 200)
        
        # Test mark all alerts as read
        self.run_test("Mark All Alerts Read", "PUT", "alerts/read-all", 200, {})

    def test_export_endpoints(self):
        """Test export endpoints"""
        print("\n📄 Testing Export Endpoints...")
        
        if not self.session_token:
            self.log_test("Export Test Setup", False, "No session token available")
            return
        
        # Test export transactions (should return CSV)
        url = f"{self.api_url}/export/transactions"
        headers = {'Authorization': f'Bearer {self.session_token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'csv' in content_type or 'text' in content_type:
                    self.log_test("Export Transactions", True, f"CSV export successful")
                else:
                    self.log_test("Export Transactions", False, f"Unexpected content type: {content_type}")
            else:
                self.log_test("Export Transactions", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Export Transactions", False, f"Exception: {e}")
        
        # Test export report
        url = f"{self.api_url}/export/report"
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'csv' in content_type or 'text' in content_type:
                    self.log_test("Export Report", True, f"Report export successful")
                else:
                    self.log_test("Export Report", False, f"Unexpected content type: {content_type}")
            else:
                self.log_test("Export Report", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Export Report", False, f"Exception: {e}")

    def test_protected_routes_without_auth(self):
        """Test that protected routes return 401 without authentication"""
        print("\n🔒 Testing Protected Routes Without Auth...")
        
        # Temporarily remove session token
        temp_token = self.session_token
        self.session_token = None
        
        protected_endpoints = [
            ("auth/me", "GET"),
            ("dashboard/stats", "GET"),
            ("transactions", "GET"),
            ("budgets", "GET"),
            ("alerts", "GET")
        ]
        
        for endpoint, method in protected_endpoints:
            self.run_test(f"Protected Route {endpoint} (No Auth)", method, endpoint, 401)
        
        # Restore session token
        self.session_token = temp_token

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        if not self.user_id:
            return
        
        mongo_script = f"""
use('test_database');
db.users.deleteMany({{email: /test\\.user\\./}});
db.user_sessions.deleteMany({{session_token: /test_session/}});
db.transactions.deleteMany({{user_id: '{self.user_id}'}});
db.budgets.deleteMany({{user_id: '{self.user_id}'}});
db.alerts.deleteMany({{user_id: '{self.user_id}'}});
print('Cleanup completed');
"""
        
        try:
            subprocess.run(['mongosh', '--eval', mongo_script], 
                          capture_output=True, text=True, timeout=30)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Fintech Dashboard API Tests")
        print(f"🎯 Testing backend: {self.base_url}")
        
        # Test basic endpoints first
        self.test_health_endpoints()
        self.test_stock_endpoints()
        
        # Create test user for auth-required tests
        if self.create_test_user_session():
            self.test_auth_endpoints()
            self.test_dashboard_endpoints()
            self.test_transaction_endpoints()
            self.test_budget_endpoints()
            self.test_alert_endpoints()
            self.test_export_endpoints()
            self.test_protected_routes_without_auth()
            self.cleanup_test_data()
        else:
            print("❌ Cannot run auth-required tests without test user")
        
        # Print summary
        print(f"\n📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed")
            return 1

def main():
    tester = FintechAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())