// Test script to verify database connection and list users
// Run with: node test-db-users.js

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function main() {
  console.log('========================================');
  console.log('  Database Connection Test');
  console.log('========================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set in .env.local');
    process.exit(1);
  }

  console.log('✓ DATABASE_URL found');
  console.log('  Preview:', databaseUrl.substring(0, 50) + '...\n');

  try {
    const sql = neon(databaseUrl);
    
    // Test connection
    console.log('Testing connection...');
    const testResult = await sql`SELECT NOW() as time`;
    console.log('✓ Connected to database at:', testResult[0].time, '\n');

    // List users
    console.log('Fetching users...\n');
    const users = await sql`
      SELECT 
        id,
        clerk_id,
        display_name,
        email,
        phone_number,
        sms_alerts_enabled,
        alert_threshold
      FROM users
      ORDER BY display_name
    `;

    if (users.length === 0) {
      console.log('⚠ No users found in database');
      console.log('\nTo add a user, run this SQL in Neon console:');
      console.log(`
INSERT INTO users (clerk_id, email, phone_number, display_name, sms_alerts_enabled, alert_threshold)
VALUES ('user_YOUR_CLERK_ID', 'your@email.com', '+1234567890', 'Your Name', true, 'DANGER');
      `);
    } else {
      console.log(`Found ${users.length} user(s):\n`);
      
      users.forEach((user, i) => {
        console.log(`${i + 1}. ${user.display_name || 'No name'}`);
        console.log(`   Clerk ID: ${user.clerk_id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone_number || '(not set)'}`);
        console.log(`   SMS Enabled: ${user.sms_alerts_enabled ? '✓ Yes' : '✗ No'}`);
        console.log(`   Threshold: ${user.alert_threshold}`);
        console.log('');
      });

      // Check SMS eligibility
      const eligible = users.filter(u => u.sms_alerts_enabled && u.phone_number);
      console.log('----------------------------------------');
      console.log(`Users eligible for SMS alerts: ${eligible.length}`);
      eligible.forEach(u => {
        console.log(`  - ${u.display_name} (${u.phone_number})`);
      });
    }

    console.log('\n========================================');
    console.log('  ✅ Database test complete');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

main();
