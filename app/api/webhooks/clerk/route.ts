import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { syncUserFromClerk } from '@/lib/db-users';

/**
 * Clerk webhook handler for user events
 * Syncs users to database when they sign up or update their profile
 * 
 * Configure this webhook in Clerk Dashboard:
 * - URL: https://yourapp.com/api/webhooks/clerk
 * - Events: user.created, user.updated, user.deleted
 */
export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Get body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('[Clerk Webhook] Verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 400 }
    );
  }

  // Handle event
  const eventType = evt.type;
  const data = evt.data;

  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        // Sync user to database
        const email = data.email_addresses?.[0]?.email_address || '';
        const phoneNumber = data.phone_numbers?.[0]?.phone_number || undefined;
        const displayName = data.first_name && data.last_name
          ? `${data.first_name} ${data.last_name}`
          : data.username || data.first_name || undefined;

        await syncUserFromClerk({
          clerk_id: data.id,
          email,
          phone_number: phoneNumber,
          display_name: displayName,
        });

        console.log(`[Clerk Webhook] User ${eventType}: ${data.id}`);
        break;
      }

      case 'user.deleted': {
        // Optionally handle user deletion
        // For now, we'll keep the user in DB but mark as inactive
        // You might want to soft-delete or hard-delete based on your needs
        console.log(`[Clerk Webhook] User deleted: ${data.id}`);
        // TODO: Handle user deletion if needed
        break;
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Clerk Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
