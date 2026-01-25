/**
 * Danger Detection & Database Storage Test
 * 
 * This script tests the complete flow:
 * 1. Simulates danger detection by calling /api/sms/alert
 * 2. Verifies events are stored in the database
 * 3. Verifies incidents are created when alerts are sent
 * 
 * Usage:
 *   node scripts/test-danger-detection.js
 * 
 * Make sure the dev server is running (npm run dev) before running this test.
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  dangerLevel: 'DANGER',
  description: 'Test danger detection - Two people fighting aggressively',
  section: 'closest',
  cameraId: 'test-camera-001',
  personGrid: Array(10).fill(null).map(() => 
    Array(10).fill(false).map(() => Math.random() > 0.7)
  ),
};

// Stats tracking
const stats = {
  apiCalls: 0,
  eventsCreated: 0,
  incidentsCreated: 0,
  errors: [],
};

/**
 * Call the alert API endpoint
 */
async function callAlertAPI(dangerLevel, description, personGrid, section, cameraId) {
  try {
    const response = await fetch(`${BASE_URL}/api/sms/alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dangerLevel,
        description,
        personGrid,
        section,
        cameraId,
      }),
    });

    const data = await response.json();
    stats.apiCalls++;

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    stats.errors.push(`API call failed: ${error.message}`);
    throw error;
  }
}

/**
 * Query database for events
 */
async function checkEventsInDB(client, expectedCount = 1) {
  try {
    const result = await client.query(`
      SELECT 
        id, 
        event_type, 
        severity, 
        title, 
        description, 
        metadata,
        camera_id,
        section,
        occurred_at,
        created_at
      FROM events 
      WHERE event_type IN ('danger_detected', 'warning_detected')
      ORDER BY occurred_at DESC 
      LIMIT $1
    `, [expectedCount + 5]); // Get a few extra to see recent ones

    return result.rows;
  } catch (error) {
    stats.errors.push(`Database query failed: ${error.message}`);
    throw error;
  }
}

/**
 * Query database for incidents
 */
async function checkIncidentsInDB(client, expectedCount = 1) {
  try {
    const result = await client.query(`
      SELECT 
        id,
        status,
        priority,
        title,
        description,
        first_event_id,
        camera_id,
        detected_at,
        created_at
      FROM incidents 
      ORDER BY detected_at DESC 
      LIMIT $1
    `, [expectedCount + 5]); // Get a few extra to see recent ones

    return result.rows;
  } catch (error) {
    stats.errors.push(`Database query failed: ${error.message}`);
    throw error;
  }
}

/**
 * Parse metadata JSON
 */
function parseMetadata(metadata) {
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata || {};
}

/**
 * Main test function
 */
async function runTest() {
  console.log('========================================');
  console.log('  Danger Detection & Database Test');
  console.log('========================================\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get initial counts
    const initialEventsResult = await client.query('SELECT COUNT(*) as count FROM events');
    const initialIncidentsResult = await client.query('SELECT COUNT(*) as count FROM incidents');
    const initialEventCount = parseInt(initialEventsResult.rows[0].count);
    const initialIncidentCount = parseInt(initialIncidentsResult.rows[0].count);

    console.log('📊 Initial Database State:');
    console.log(`   Events: ${initialEventCount}`);
    console.log(`   Incidents: ${initialIncidentCount}\n`);

    // Test 1: Send a single DANGER detection (should create event, but not incident yet)
    console.log('🧪 Test 1: Sending single DANGER detection...');
    try {
      const response1 = await callAlertAPI(
        TEST_CONFIG.dangerLevel,
        TEST_CONFIG.description,
        TEST_CONFIG.personGrid,
        TEST_CONFIG.section,
        TEST_CONFIG.cameraId
      );
      console.log(`   ✅ API Response: ${JSON.stringify(response1, null, 2)}`);
      
      if (response1.eventId) {
        console.log(`   ✅ Event ID returned: ${response1.eventId}`);
        stats.eventsCreated++;
      } else {
        console.log(`   ⚠️  No event ID in response (may be stored but not returned)`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }

    // Wait a moment for database writes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 2: Send 2 more DANGER detections to trigger alert (should create incident)
    console.log('\n🧪 Test 2: Sending 2 more DANGER detections to trigger alert...');
    for (let i = 0; i < 2; i++) {
      try {
        const response = await callAlertAPI(
          TEST_CONFIG.dangerLevel,
          `${TEST_CONFIG.description} (trigger ${i + 2})`,
          TEST_CONFIG.personGrid,
          TEST_CONFIG.section,
          TEST_CONFIG.cameraId
        );
        console.log(`   ✅ Call ${i + 2} - Consecutive count: ${response.consecutiveCount || 'N/A'}`);
        
        if (response.eventId) {
          stats.eventsCreated++;
        }
        
        if (response.incidentId) {
          console.log(`   ✅ Incident created! ID: ${response.incidentId}`);
          stats.incidentsCreated++;
        }
        
        // Wait between calls
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`   ❌ Call ${i + 2} failed: ${error.message}`);
      }
    }

    // Wait for all database writes to complete
    console.log('\n⏳ Waiting for database writes to complete...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify events in database
    console.log('\n📋 Verifying Events in Database:');
    const events = await checkEventsInDB(client, 3);
    const newEvents = events.filter(e => {
      const metadata = parseMetadata(e.metadata);
      return metadata.danger_level === 'DANGER' && 
             e.camera_id === TEST_CONFIG.cameraId;
    });

    console.log(`   Found ${events.length} recent events`);
    console.log(`   Found ${newEvents.length} matching test events\n`);

    if (newEvents.length > 0) {
      console.log('   ✅ Event Details:');
      newEvents.slice(0, 3).forEach((event, idx) => {
        const metadata = parseMetadata(event.metadata);
        console.log(`   Event ${idx + 1}:`);
        console.log(`      ID: ${event.id}`);
        console.log(`      Type: ${event.event_type}`);
        console.log(`      Severity: ${event.severity}`);
        console.log(`      Title: ${event.title}`);
        console.log(`      Camera: ${event.camera_id}`);
        console.log(`      Section: ${event.section || 'N/A'}`);
        console.log(`      Consecutive Count: ${metadata.consecutive_count || 'N/A'}`);
        console.log(`      Person Count: ${metadata.person_count || 'N/A'}`);
        console.log(`      Occurred At: ${new Date(event.occurred_at).toLocaleString()}`);
        console.log('');
      });
      stats.eventsCreated = newEvents.length;
    } else {
      console.log('   ❌ No matching events found in database');
      stats.errors.push('No events found matching test criteria');
    }

    // Verify incidents in database
    console.log('📋 Verifying Incidents in Database:');
    const incidents = await checkIncidentsInDB(client, 1);
    const newIncidents = incidents.filter(i => 
      i.camera_id === TEST_CONFIG.cameraId &&
      i.priority === 'critical'
    );

    console.log(`   Found ${incidents.length} recent incidents`);
    console.log(`   Found ${newIncidents.length} matching test incidents\n`);

    if (newIncidents.length > 0) {
      console.log('   ✅ Incident Details:');
      newIncidents.slice(0, 1).forEach((incident, idx) => {
        console.log(`   Incident ${idx + 1}:`);
        console.log(`      ID: ${incident.id}`);
        console.log(`      Status: ${incident.status}`);
        console.log(`      Priority: ${incident.priority}`);
        console.log(`      Title: ${incident.title}`);
        console.log(`      Camera: ${incident.camera_id}`);
        console.log(`      First Event ID: ${incident.first_event_id}`);
        console.log(`      Detected At: ${new Date(incident.detected_at).toLocaleString()}`);
        console.log('');
      });
      stats.incidentsCreated = newIncidents.length;
    } else {
      console.log('   ⚠️  No incidents found (this is OK if alert threshold not reached)');
    }

    // Final summary
    console.log('========================================');
    console.log('  Test Summary');
    console.log('========================================');
    console.log(`✅ API Calls Made: ${stats.apiCalls}`);
    console.log(`✅ Events Created: ${stats.eventsCreated}`);
    console.log(`✅ Incidents Created: ${stats.incidentsCreated}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors: ${stats.errors.length}`);
      stats.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No errors!');
    }

    // Final database counts
    const finalEventsResult = await client.query('SELECT COUNT(*) as count FROM events');
    const finalIncidentsResult = await client.query('SELECT COUNT(*) as count FROM incidents');
    const finalEventCount = parseInt(finalEventsResult.rows[0].count);
    const finalIncidentCount = parseInt(finalIncidentsResult.rows[0].count);

    console.log('\n📊 Final Database State:');
    console.log(`   Events: ${finalEventCount} (${finalEventCount - initialEventCount > 0 ? '+' : ''}${finalEventCount - initialEventCount})`);
    console.log(`   Incidents: ${finalIncidentCount} (${finalIncidentCount - initialIncidentCount > 0 ? '+' : ''}${finalIncidentCount - initialIncidentCount})`);

    if (stats.eventsCreated > 0) {
      console.log('\n✅ SUCCESS: Danger detection events are being stored in the database!');
    } else {
      console.log('\n❌ FAIL: No events were stored. Check the API endpoint and database connection.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
