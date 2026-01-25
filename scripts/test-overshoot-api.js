/**
 * Overshoot API Key Test Script
 * 
 * This script tests if your Overshoot API key is valid and working.
 * 
 * Usage:
 *   node test-overshoot-api.js
 * 
 * Make sure your .env.local file contains OVERSHOOT_API_KEY before running.
 */

require('dotenv').config({ path: '.env.local' });

const API_URL = 'https://cluster1.overshoot.ai/api/v0.2';

async function testOvershootApiKey() {
  console.log('\n========================================');
  console.log('  Overshoot API Key Test');
  console.log('========================================\n');

  // Check if API key is set
  const apiKey = process.env.OVERSHOOT_API_KEY;
  
  if (!apiKey) {
    console.log('❌ FAIL: OVERSHOOT_API_KEY is not set in .env.local');
    console.log('\nPlease add your API key to .env.local:');
    console.log('  OVERSHOOT_API_KEY=your_actual_api_key_here\n');
    process.exit(1);
  }

  if (apiKey === 'your_api_key_here') {
    console.log('❌ FAIL: OVERSHOOT_API_KEY is still set to placeholder value');
    console.log('\nPlease replace "your_api_key_here" with your actual API key in .env.local\n');
    process.exit(1);
  }

  console.log('✓ API key found in environment');
  console.log(`  Key preview: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`  Key length: ${apiKey.length} characters\n`);

  // Test API connection
  console.log('Testing API connection...');
  console.log(`  Endpoint: ${API_URL}\n`);

  try {
    // Try a simple health check or authentication test
    // Most APIs support a lightweight endpoint to verify credentials
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`  Response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log('\n✅ SUCCESS: API key is valid and API is reachable!\n');
      
      try {
        const data = await response.json();
        console.log('Response data:', JSON.stringify(data, null, 2));
      } catch {
        const text = await response.text();
        if (text) {
          console.log('Response:', text);
        }
      }
    } else if (response.status === 401 || response.status === 403) {
      console.log('\n❌ FAIL: API key is invalid or unauthorized');
      console.log('\nPlease check:');
      console.log('  1. Your API key is correct');
      console.log('  2. Your API key has not expired');
      console.log('  3. Your account has access to this API\n');
      
      try {
        const errorData = await response.json();
        console.log('Error details:', JSON.stringify(errorData, null, 2));
      } catch {
        // Ignore JSON parse errors
      }
      process.exit(1);
    } else if (response.status === 404) {
      // Health endpoint might not exist, try alternative validation
      console.log('  Health endpoint not found, trying alternative validation...\n');
      await testAlternativeEndpoint(apiKey);
    } else {
      console.log(`\n⚠️  WARNING: Unexpected response status ${response.status}`);
      try {
        const text = await response.text();
        console.log('Response:', text);
      } catch {
        // Ignore
      }
    }
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('\n❌ FAIL: Cannot connect to Overshoot API');
      console.log('\nPlease check:');
      console.log('  1. Your internet connection');
      console.log('  2. The API URL is correct');
      console.log(`  3. ${API_URL} is accessible\n`);
    } else {
      console.log('\n❌ FAIL: Error testing API');
      console.log(`  Error: ${error.message}\n`);
    }
    process.exit(1);
  }

  console.log('========================================\n');
}

async function testAlternativeEndpoint(apiKey) {
  // Try to make a minimal API call that would validate the key
  // This could be listing models, getting account info, etc.
  
  const endpoints = [
    '/models',
    '/account',
    '/user',
    '/status',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`  Testing ${endpoint}: ${response.status}`);

      if (response.status === 401 || response.status === 403) {
        console.log('\n❌ FAIL: API key is invalid or unauthorized\n');
        process.exit(1);
      }

      if (response.ok) {
        console.log(`\n✅ SUCCESS: API key appears to be valid (${endpoint} returned ${response.status})\n`);
        return;
      }
    } catch (error) {
      console.log(`  Testing ${endpoint}: Error - ${error.message}`);
    }
  }

  console.log('\n⚠️  Could not definitively verify API key');
  console.log('  The API key format looks valid, but no test endpoints responded.');
  console.log('  The key may still work with the RealtimeVision SDK.\n');
}

// Also check for the client-side key
function checkClientSideKey() {
  const clientKey = process.env.NEXT_PUBLIC_OVERSHOOT_API_KEY;
  
  console.log('----------------------------------------');
  console.log('Client-side key check (NEXT_PUBLIC_OVERSHOOT_API_KEY):');
  
  if (!clientKey) {
    console.log('  ⚠️  Not set - client-side features may not work');
    console.log('  Add to .env.local if needed:');
    console.log('    NEXT_PUBLIC_OVERSHOOT_API_KEY=your_api_key_here\n');
  } else if (clientKey === 'your_api_key_here') {
    console.log('  ⚠️  Still set to placeholder value\n');
  } else {
    console.log('  ✓ Set');
    console.log(`  Key preview: ${clientKey.substring(0, 8)}...${clientKey.substring(clientKey.length - 4)}\n`);
  }
}

// Run the test
testOvershootApiKey().then(() => {
  checkClientSideKey();
}).catch(console.error);
