/**
 * Danger Detection & Database Storage Test (Direct Database Test)
 * 
 * This script tests the database storage directly without requiring the API server:
 * 1. Directly calls database functions to create events
 * 2. Directly calls database functions to create incidents
 * 3. Verifies data is stored correctly
 * 
 * Usage:
 *   node scripts/test-danger-detection-direct.js
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Import database utilities (we'll need to use CommonJS require for the compiled JS)
// Since these are TypeScript files, we'll call the database functions directly via SQL

/**
 * Create an event directly in the database
 */
async function createEventDirect(client, data) {
  const result = await client.query(`
    INSERT INTO events (
      user_id, event_type, severity, title, description, metadata, 
      camera_id, section, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    data.user_id || null,
    data.event_type,
    data.severity,
    data.title,
    data.description || null,
    JSON.stringify(data.metadata || {}),
    data.camera_id || null,
    data.section || null,
    data.occurred_at || new Date(),
  ]);

  return result.rows[0].id;
}

/**
 * Create an incident directly in the database
 */
async function createIncidentDirect(client, data) {
  const result = await client.query(`
    INSERT INTO incidents (
      user_id, location_id, status, priority, title, description,
      first_event_id, camera_id, detected_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    data.user_id || null,
    data.location_id || null,
    data.status || 'open',
    data.priority,
    data.title,
    data.description || null,
    data.first_event_id,
    data.camera_id || null,
    data.detected_at || new Date(),
  ]);

  return result.rows[0].id;
}

/**
 * Main test function
 */
async function runTest() {
  console.log('========================================');
  console.log('  Danger Detection & Database Test');
  console.log('  (Direct Database Test)');
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

    // Test configuration
    const testConfig = {
      dangerLevel: 'DANGER',
      description: 'Test danger detection - Two people fighting aggressively',
      section: 'closest',
      cameraId: 'test-camera-direct-001',
      personGrid: Array(10).fill(null).map(() => 
        Array(10).fill(false).map(() => Math.random() > 0.7)
      ),
    };

    // Count people in grid
    const personCount = testConfig.personGrid.flat().filter(Boolean).length;

    // Test 1: Create a WARNING event
    console.log('🧪 Test 1: Creating WARNING event...');
    const warningEventId = await createEventDirect(client, {
      event_type: 'warning_detected',
      severity: 'MEDIUM',
      title: 'WARNING detected in closest section',
      description: 'Test warning detection',
      metadata: {
        danger_level: 'WARNING',
        section: testConfig.section,
        person_count: personCount,
        consecutive_count: 1,
        grid: testConfig.personGrid,
      },
      camera_id: testConfig.cameraId,
      section: testConfig.section,
    });
    console.log(`   ✅ WARNING Event created: ${warningEventId}\n`);

    // Test 2: Create a DANGER event
    console.log('🧪 Test 2: Creating DANGER event...');
    const dangerEventId = await createEventDirect(client, {
      event_type: 'danger_detected',
      severity: 'CRITICAL',
      title: 'DANGER detected in closest section',
      description: testConfig.description,
      metadata: {
        danger_level: 'DANGER',
        section: testConfig.section,
        person_count: personCount,
        consecutive_count: 3,
        grid: testConfig.personGrid,
      },
      camera_id: testConfig.cameraId,
      section: testConfig.section,
    });
    console.log(`   ✅ DANGER Event created: ${dangerEventId}\n`);

    // Test 3: Create an incident from the DANGER event
    console.log('🧪 Test 3: Creating incident from DANGER event...');
    const incidentId = await createIncidentDirect(client, {
      status: 'open',
      priority: 'critical',
      title: 'DANGER incident detected',
      description: testConfig.description,
      first_event_id: dangerEventId,
      camera_id: testConfig.cameraId,
    });
    console.log(`   ✅ Incident created: ${incidentId}\n`);

    // Verify events in database
    console.log('📋 Verifying Events in Database:');
    const eventsResult = await client.query(`
      SELECT 
        id, 
        event_type, 
        severity, 
        title, 
        description, 
        metadata,
        camera_id,
        section,
        occurred_at
      FROM events 
      WHERE camera_id = $1
      ORDER BY occurred_at DESC
    `, [testConfig.cameraId]);

    const events = eventsResult.rows;
    console.log(`   Found ${events.length} events for test camera\n`);

    if (events.length >= 2) {
      console.log('   ✅ Event Details:');
      events.forEach((event, idx) => {
        const metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        console.log(`   Event ${idx + 1}:`);
        console.log(`      ID: ${event.id}`);
        console.log(`      Type: ${event.event_type}`);
        console.log(`      Severity: ${event.severity}`);
        console.log(`      Title: ${event.title}`);
        console.log(`      Camera: ${event.camera_id}`);
        console.log(`      Section: ${event.section || 'N/A'}`);
        console.log(`      Danger Level: ${metadata.danger_level || 'N/A'}`);
        console.log(`      Consecutive Count: ${metadata.consecutive_count || 'N/A'}`);
        console.log(`      Person Count: ${metadata.person_count || 'N/A'}`);
        console.log(`      Occurred At: ${new Date(event.occurred_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('   ❌ Expected at least 2 events, found ${events.length}');
    }

    // Verify incidents in database
    console.log('📋 Verifying Incidents in Database:');
    const incidentsResult = await client.query(`
      SELECT 
        id,
        status,
        priority,
        title,
        description,
        first_event_id,
        camera_id,
        detected_at
      FROM incidents 
      WHERE camera_id = $1
      ORDER BY detected_at DESC
    `, [testConfig.cameraId]);

    const incidents = incidentsResult.rows;
    console.log(`   Found ${incidents.length} incidents for test camera\n`);

    if (incidents.length >= 1) {
      console.log('   ✅ Incident Details:');
      incidents.forEach((incident, idx) => {
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
    } else {
      console.log('   ❌ Expected at least 1 incident, found ${incidents.length}');
    }

    // Final database counts
    const finalEventsResult = await client.query('SELECT COUNT(*) as count FROM events');
    const finalIncidentsResult = await client.query('SELECT COUNT(*) as count FROM incidents');
    const finalEventCount = parseInt(finalEventsResult.rows[0].count);
    const finalIncidentCount = parseInt(finalIncidentsResult.rows[0].count);

    console.log('========================================');
    console.log('  Test Summary');
    console.log('========================================');
    console.log(`✅ Events Created: ${events.length}`);
    console.log(`✅ Incidents Created: ${incidents.length}`);
    console.log(`\n📊 Database State:`);
    console.log(`   Events: ${finalEventCount} (+${finalEventCount - initialEventCount})`);
    console.log(`   Incidents: ${finalIncidentCount} (+${finalIncidentCount - initialIncidentCount})`);

    if (events.length >= 2 && incidents.length >= 1) {
      console.log('\n✅ SUCCESS: Danger detection events and incidents are being stored correctly!');
      console.log('\n💡 Next Steps:');
      console.log('   1. Start the dev server: npm run dev');
      console.log('   2. Run the API test: npm run test:danger');
      console.log('   3. Check the API routes: GET /api/incidents, GET /api/warnings');
    } else {
      console.log('\n❌ FAIL: Expected events and incidents not found.');
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
