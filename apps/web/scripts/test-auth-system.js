#!/usr/bin/env node

/**
 * Comprehensive Authentication System Test Suite
 * Tests all aspects of the NextAuth.js implementation
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const TEST_USERS = [
  {
    name: 'Test Admin',
    email: 'admin@dealershipai.test',
    password: 'admin123',
    dealerName: 'Admin Test Dealer',
    expectedRole: 'admin'
  },
  {
    name: 'Test Dealer',
    email: 'dealer@dealershipai.test',
    password: 'dealer123',
    dealerName: 'Test Dealer Corp',
    expectedRole: 'dealer'
  },
  {
    name: 'Test User',
    email: 'user@dealershipai.test',
    password: 'user123',
    dealerName: 'User Test Dealer',
    expectedRole: 'user'
  }
];

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);

  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function logSection(name) {
  console.log(`\n🔍 ${name}`);
  console.log('='.repeat(50));
}

async function testUserRegistration() {
  logSection('User Registration Flow');

  for (const user of TEST_USERS) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });

      const result = await response.json();

      if (response.ok && result.user) {
        logTest(
          `Register ${user.expectedRole} user`,
          true,
          `User ID: ${result.user.id}, Role: ${result.user.role}`
        );
      } else {
        logTest(
          `Register ${user.expectedRole} user`,
          false,
          `${result.error || 'Registration failed'}`
        );
      }
    } catch (error) {
      logTest(
        `Register ${user.expectedRole} user`,
        false,
        `Network error: ${error.message}`
      );
    }
  }
}

async function testCredentialsSignIn() {
  logSection('Credentials Sign-In Flow');

  for (const user of TEST_USERS) {
    try {
      // Test credentials sign-in via NextAuth
      const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          email: user.email,
          password: user.password,
          csrfToken: 'test-token'
        }).toString()
      });

      if (response.ok) {
        logTest(`Credentials sign-in for ${user.expectedRole}`, true);
      } else {
        logTest(`Credentials sign-in for ${user.expectedRole}`, false, `HTTP ${response.status}`);
      }
    } catch (error) {
      logTest(`Credentials sign-in for ${user.expectedRole}`, false, error.message);
    }
  }
}

async function testApiEndpointProtection() {
  logSection('API Endpoint Protection');

  // Test unprotected endpoint
  try {
    const healthResponse = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'GET'
    });

    if (healthResponse.ok) {
      logTest('Unprotected endpoint accessible', true);
    } else {
      logTest('Unprotected endpoint accessible', false, `HTTP ${healthResponse.status}`);
    }
  } catch (error) {
    logTest('Unprotected endpoint accessible', false, error.message);
  }

  // Test protected endpoints without auth
  const protectedEndpoints = [
    { url: '/api/dashboard/enhanced', method: 'GET' },
    { url: '/api/ai/chat', method: 'POST', body: { message: 'test' } }
  ];

  for (const endpoint of protectedEndpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint.url}`, {
        method: endpoint.method,
        headers: endpoint.body ? { 'Content-Type': 'application/json' } : {},
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
      });

      const shouldBeUnauthorized = response.status === 401 || response.status === 403;
      logTest(
        `Protected ${endpoint.method} ${endpoint.url} blocks unauth requests`,
        shouldBeUnauthorized,
        `HTTP ${response.status}`
      );
    } catch (error) {
      logTest(`Protected ${endpoint.method} ${endpoint.url}`, false, error.message);
    }
  }
}

async function testDatabaseIntegrity() {
  logSection('Database Integrity');

  // Import Prisma to check database state
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Check users were created
    const userCount = await prisma.user.count();
    logTest('Users created in database', userCount >= TEST_USERS.length, `Found ${userCount} users`);

    // Check dealers were created
    const dealerCount = await prisma.dealer.count();
    logTest('Dealers created in database', dealerCount >= TEST_USERS.length, `Found ${dealerCount} dealers`);

    // Check user-dealer relationships
    const usersWithDealers = await prisma.user.findMany({
      include: { dealer: true }
    });

    const validRelationships = usersWithDealers.filter(u => u.dealer).length;
    logTest(
      'User-dealer relationships established',
      validRelationships >= TEST_USERS.length,
      `${validRelationships} valid relationships`
    );

    await prisma.$disconnect();
  } catch (error) {
    logTest('Database integrity check', false, error.message);
  }
}

async function testEnvironmentConfiguration() {
  logSection('Environment Configuration');

  const requiredEnvVars = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    const exists = process.env[envVar];
    logTest(`Environment variable ${envVar}`, !!exists, exists ? 'Set' : 'Missing');
  }
}

async function runAllTests() {
  console.log('🚀 Starting Authentication System Test Suite\n');

  await testEnvironmentConfiguration();
  await testDatabaseIntegrity();
  await testUserRegistration();
  await testCredentialsSignIn();
  await testApiEndpointProtection();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`   • ${t.name}: ${t.details}`));
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { runAllTests };