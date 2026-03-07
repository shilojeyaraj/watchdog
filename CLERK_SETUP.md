# Clerk Authentication Setup

Complete guide for Clerk authentication integration with database sync.

## ✅ What's Been Set Up

### 1. Clerk Integration
- ✅ `@clerk/nextjs` package installed
- ✅ `ClerkProvider` added to root layout
- ✅ Middleware for route protection
- ✅ Sign-in and sign-up pages
- ✅ Home page updated with Clerk components

### 2. Database Sync
- ✅ User sync utility (`lib/db-users.ts`)
- ✅ API route for user sync (`/api/users/sync`)
- ✅ Webhook handler for Clerk events (`/api/webhooks/clerk`)
- ✅ Auto-sync component (`components/UserSync.tsx`)

### 3. Protected Routes
- ✅ Dashboard requires authentication
- ✅ Public routes: `/`, `/sign-in`, `/sign-up`, webhooks

## 📁 Files Created/Modified

### New Files
- `middleware.ts` - Route protection
- `app/sign-in/[[...sign-in]]/page.tsx` - Sign-in page
- `app/sign-up/[[...sign-up]]/page.tsx` - Sign-up page
- `app/api/users/sync/route.ts` - User sync API
- `app/api/webhooks/clerk/route.ts` - Clerk webhook handler
- `lib/db-users.ts` - User database utilities
- `components/UserSync.tsx` - Auto-sync component

### Modified Files
- `app/layout.tsx` - Added ClerkProvider and UserSync
- `app/page.tsx` - Updated with Clerk components
- `app/dashboard/page.tsx` - Added authentication check

## 🔧 Environment Variables

Make sure these are set in `.env.local`:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Webhook (optional, for automatic sync)
CLERK_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://...
```

## 🔄 How User Sync Works

### Method 1: Client-Side Auto-Sync (Current)
When a user signs in, the `UserSync` component automatically calls `/api/users/sync` to ensure the user exists in the database.

**Flow:**
1. User signs in via Clerk
2. `UserSync` component detects authenticated user
3. Calls `/api/users/sync` POST endpoint
4. Server syncs user data to database
5. User can now use the app

### Method 2: Webhook Sync (Recommended for Production)
Clerk sends webhooks when users are created/updated, automatically syncing to database.

**Setup:**
1. Go to Clerk Dashboard → Webhooks
2. Create new webhook endpoint
3. URL: `https://yourapp.com/api/webhooks/clerk`
4. Events: `user.created`, `user.updated`, `user.deleted`
5. Copy webhook secret to `CLERK_WEBHOOK_SECRET` in `.env.local`

**Flow:**
1. User signs up in Clerk
2. Clerk sends `user.created` webhook
3. Webhook handler syncs user to database
4. User is immediately available in database

## 🚀 Usage

### Sign In Flow
1. User visits `/` (home page)
2. Clicks "Sign In" button
3. Clerk modal opens for authentication
4. After sign-in, redirected to `/dashboard`
5. User automatically synced to database

### Sign Up Flow
1. User visits `/` (home page)
2. Clicks "Sign up" link
3. Navigates to `/sign-up` page
4. Creates account via Clerk
5. After sign-up, redirected to `/dashboard`
6. User automatically synced to database

### Dashboard Access
- Dashboard (`/dashboard`) requires authentication
- Unauthenticated users are redirected to `/sign-in`
- Authenticated users see their dashboard with their name

## 📊 Database Schema

Users are stored in the `users` table with:

| Column | Source | Description |
|--------|--------|-------------|
| `clerk_id` | Clerk | Unique Clerk user ID |
| `email` | Clerk | User's email address |
| `phone_number` | Clerk | Phone number (if provided) |
| `display_name` | Clerk | First + Last name or username |
| `sms_alerts_enabled` | Default | `true` |
| `email_alerts_enabled` | Default | `false` |
| `alert_threshold` | Default | `'DANGER'` |
| `last_login_at` | Auto | Updated on each sync |

## 🔍 API Endpoints

### POST /api/users/sync
Syncs current authenticated user to database.

**Request:** (automatic, no body needed)
**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "message": "User synced successfully"
}
```

### GET /api/users/sync
Checks if current user is synced.

**Response:**
```json
{
  "synced": true,
  "userId": "uuid"
}
```

### POST /api/webhooks/clerk
Clerk webhook endpoint (requires `CLERK_WEBHOOK_SECRET`).

**Events Handled:**
- `user.created` - Creates user in database
- `user.updated` - Updates user in database
- `user.deleted` - Logs deletion (doesn't delete from DB)

## 🛠️ User Database Utilities

### `syncUserFromClerk(userData)`
Syncs user from Clerk to database. Creates if new, updates if exists.

### `getUserByClerkId(clerkId)`
Gets user by Clerk ID.

### `getUserById(userId)`
Gets user by database ID.

### `updateUserPreferences(userId, preferences)`
Updates user alert preferences.

## 🔐 Security Notes

1. **Webhook Verification**: Clerk webhooks are verified using Svix signatures
2. **Authentication**: All protected routes require Clerk authentication
3. **User Isolation**: Each user's data is isolated by `user_id`
4. **API Keys**: User API keys should be encrypted before storing (future enhancement)

## 🧪 Testing

1. **Test Sign In:**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Click "Sign In"
   # Sign in with test account
   # Should redirect to /dashboard
   ```

2. **Test Database Sync:**
   ```bash
   # After signing in, check database
   npm run db:test
   # Should show user in users table
   ```

3. **Test Webhook (requires public URL):**
   - Use ngrok or similar to expose localhost
   - Configure webhook in Clerk Dashboard
   - Sign up new user
   - Check database for new user

## 📝 Next Steps

1. **Set up webhook** (recommended for production):
   - Configure in Clerk Dashboard
   - Add `CLERK_WEBHOOK_SECRET` to `.env.local`

2. **Update application code** to use `user_id`:
   - Events should be linked to `user_id`
   - Incidents should be linked to `user_id`
   - All user-specific data should use `user_id`

3. **Add user preferences page**:
   - Allow users to update alert preferences
   - Update phone number
   - Manage API keys

4. **Add organization support**:
   - Link users to organizations
   - Implement role-based access

## ⚠️ Troubleshooting

### Issue: User not syncing
**Check:**
1. Clerk keys are correct in `.env.local`
2. Database connection is working
3. Check browser console for errors
4. Check server logs for API errors

### Issue: Redirect loop
**Check:**
1. Middleware `publicRoutes` includes `/sign-in` and `/sign-up`
2. `afterSignInUrl` and `afterSignUpUrl` are correct
3. Dashboard route is protected

### Issue: Webhook not working
**Check:**
1. `CLERK_WEBHOOK_SECRET` is set
2. Webhook URL is publicly accessible
3. Webhook events are configured in Clerk Dashboard
4. Check webhook logs in Clerk Dashboard

## ✅ Status

- ✅ Clerk authentication integrated
- ✅ Database sync implemented
- ✅ Protected routes configured
- ✅ Sign-in/sign-up pages created
- ⏳ Webhook setup (optional, for production)

The authentication system is ready to use! Users can sign in/up and their data will automatically sync to the database.
