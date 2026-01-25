import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { syncUserFromClerk } from '@/lib/db-users';

/**
 * API route to sync Clerk user with database
 * Called after sign-in/sign-up to ensure user exists in database
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from Clerk
    const authResult = await auth();
    const clerkId = authResult?.userId;
    
    console.log('[User Sync API] Auth result:', { 
      hasUserId: !!clerkId,
      userId: clerkId 
    });
    
    if (!clerkId) {
      console.error('[User Sync API] No userId from auth()');
      return NextResponse.json(
        { error: 'Unauthorized', details: 'No user ID found in auth()' },
        { status: 401 }
      );
    }

    // Get full user data from Clerk
    const clerkUser = await currentUser();
    
    console.log('[User Sync API] Clerk user:', {
      hasUser: !!clerkUser,
      email: clerkUser?.emailAddresses[0]?.emailAddress,
      firstName: clerkUser?.firstName,
      lastName: clerkUser?.lastName
    });
    
    if (!clerkUser) {
      console.error('[User Sync API] currentUser() returned null');
      return NextResponse.json(
        { error: 'User not found in Clerk' },
        { status: 404 }
      );
    }

    // Extract user data
    const email = clerkUser.emailAddresses[0]?.emailAddress || '';
    const phoneNumber = clerkUser.phoneNumbers[0]?.phoneNumber || undefined;
    const displayName = clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.username || clerkUser.firstName || undefined;

    console.log('[User Sync API] Syncing user to database:', {
      clerk_id: clerkId,
      email,
      phone_number: phoneNumber || 'none',
      display_name: displayName || 'none'
    });

    // Sync to database
    const userId = await syncUserFromClerk({
      clerk_id: clerkId,
      email,
      phone_number: phoneNumber,
      display_name: displayName,
    });

    console.log('[User Sync API] User synced successfully:', { userId });

    return NextResponse.json({
      success: true,
      userId,
      message: 'User synced successfully',
    });
  } catch (error) {
    console.error('[User Sync API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync user',
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if user is synced
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { getUserByClerkId } = await import('@/lib/db-users');
    const user = await getUserByClerkId(clerkId);

    return NextResponse.json({
      synced: !!user,
      userId: user?.id || null,
    });
  } catch (error) {
    console.error('[User Sync API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check user sync status' },
      { status: 500 }
    );
  }
}
