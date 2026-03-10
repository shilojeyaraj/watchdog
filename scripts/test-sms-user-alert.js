// Test script to verify SMS alert system works end-to-end
// Run with: node scripts/test-sms-user-alert.js <clerk_id>
//
// This script:
// 1. Connects to Neon database (using @neondatabase/serverless)
// 2. Looks up the user by Clerk ID
// 3. Sends a test SMS if the user has SMS enabled

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function testUserAlert() {
  const clerkId = process.argv[2];
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not set in .env.local');
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  
  if (!clerkId) {
    console.log('========================================');
    console.log('  SMS User Alert Test');
    console.log('========================================');
    console.log('');
    console.log('Usage: node scripts/test-sms-user-alert.js <clerk_id>');
    console.log('');
    
    // List users in database
    console.log('Fetching users from database...');
    
    try {
      const users = await sql`
        SELECT clerk_id, display_name, email, phone_number, sms_alerts_enabled 
        FROM users 
        ORDER BY display_name
      `;
      
      if (users.length === 0) {
        console.log('No users found in database.');
      } else {
        console.log('');
        console.log('Users in database:');
        console.log('------------------');
        users.forEach(user => {
          console.log(`  Clerk ID: ${user.clerk_id}`);
          console.log(`  Name: ${user.display_name || 'Not set'}`);
          console.log(`  Email: ${user.email}`);
          console.log(`  Phone: ${user.phone_number || 'Not set'}`);
          console.log(`  SMS Enabled: ${user.sms_alerts_enabled}`);
          console.log('');
        });
        
        console.log('To test SMS, run:');
        console.log(`  node scripts/test-sms-user-alert.js ${users[0]?.clerk_id || '<clerk_id>'}`);
      }
    } catch (error) {
      console.error('Database error:', error.message);
    }
    
    return;
  }

  console.log('========================================');
  console.log('  SMS User Alert Test - "Yooo!"');
  console.log('========================================');
  console.log('');
  console.log('Testing with Clerk ID:', clerkId);
  console.log('');

  // Check environment variables
  console.log('1. Checking environment variables...');
  const requiredVars = ['DATABASE_URL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing.join(', '));
    return;
  }
  console.log('✓ All environment variables set');
  console.log('  TWILIO_FROM_NUMBER:', process.env.TWILIO_FROM_NUMBER);
  console.log('');

  try {
    // Look up user
    console.log('2. Looking up user in database...');
    const users = await sql`
      SELECT id, clerk_id, display_name, email, phone_number, sms_alerts_enabled, alert_threshold
      FROM users
      WHERE clerk_id = ${clerkId}
      LIMIT 1
    `;

    if (users.length === 0) {
      console.log('❌ User not found for Clerk ID:', clerkId);
      return;
    }

    const user = users[0];
    console.log('✓ User found:');
    console.log('  Name:', user.display_name || 'Not set');
    console.log('  Email:', user.email);
    console.log('  Phone:', user.phone_number || 'NOT SET');
    console.log('  SMS Enabled:', user.sms_alerts_enabled);
    console.log('');

    // Check eligibility
    console.log('3. Checking eligibility...');
    
    if (!user.sms_alerts_enabled) {
      console.log('⚠ SMS alerts DISABLED for this user');
      return;
    }

    if (!user.phone_number) {
      console.log('⚠ No phone number configured');
      return;
    }

    console.log('✓ User eligible for SMS');
    console.log('');

    // Send SMS
    console.log('4. Sending "Yooo!" SMS...');
    console.log('  From:', process.env.TWILIO_FROM_NUMBER);
    console.log('  To:', user.phone_number);
    console.log('');
    
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await twilio.messages.create({
      body: 'Yooo! 🎉',
      from: process.env.TWILIO_FROM_NUMBER,
      to: user.phone_number
    });

    const timestamp = new Date().toISOString();
    console.log(`[SMS SENT] ${timestamp} | ClerkID: ${user.clerk_id} | Name: ${user.display_name || user.email} | Phone: ${user.phone_number} | SID: ${message.sid} | Status: ${message.status} | Message: Yooo! 🎉`);

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    
    if (error.code === 21608) {
      console.error('FIX: Invalid "from" number. Check TWILIO_FROM_NUMBER.');
    } else if (error.code === 21211) {
      console.error('FIX: Invalid "to" number format. Should be +14372452243');
    } else if (error.code === 21614 || error.code === 21408) {
      console.error('FIX: Phone not verified. Go to:');
      console.error('https://www.twilio.com/console/phone-numbers/verified');
    }
  }
}

testUserAlert();
