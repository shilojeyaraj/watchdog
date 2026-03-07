# Watchdog Development Progress Log

This document tracks all major changes made to the codebase during development. Use this as a reference to understand what modifications have been implemented and why.

---

## Table of Contents
- [January 25, 2026](#january-25-2026)

---

## January 25, 2026

### Camera API Logging Enhancement

**Files Modified:**
- `app/api/camera/store.ts`
- `app/api/camera/frame/route.ts`
- `app/api/camera/upload/route.ts`

**Purpose:**  
Added comprehensive terminal logging throughout the camera API to aid in debugging and understanding the flow of camera frame data through the system.

**Changes Made:**

#### 1. `app/api/camera/store.ts` - In-Memory Frame Store

Added logging to both core functions:

**`setFrame()` function now logs:**
- Camera ID being stored
- Image data length (in characters)
- Timestamp with ISO date format
- Total frames currently in store
- Cleanup operations for frames older than 5 seconds
- Number of frames removed during cleanup

**`getFrame()` function now logs:**
- Camera ID being requested
- Whether frame was found or not
- Frame age (in milliseconds) if found
- Image data length if found
- List of available camera IDs when frame is not found (helpful for debugging mismatched IDs)

#### 2. `app/api/camera/frame/route.ts` - Frame GET/POST Endpoint

**GET `/api/camera/frame` now logs:**
- Visual separator for easy log reading
- Full request URL
- Requested camera ID (or 'default' if not specified)
- Whether frame was found or null
- Frame timestamp and data length when returning

**POST `/api/camera/frame` now logs:**
- Visual separator for easy log reading
- Camera ID from request body
- Whether imageData is present
- Image data length
- Timestamp (or note that Date.now() will be used)
- Success/error status

#### 3. `app/api/camera/upload/route.ts` - Frame Upload Endpoint

**POST `/api/camera/upload` now logs:**
- Visual separator for easy log reading
- Camera ID from request body
- Whether imageData is present
- Image data length
- Preview of first 50 characters of image data (useful for verifying base64 format)
- Timestamp (or note that Date.now() will be used)
- Success/error status

**Log Prefixes Used:**
| Prefix | Source File |
|--------|-------------|
| `[CAMERA STORE]` | `store.ts` |
| `[CAMERA FRAME API]` | `frame/route.ts` |
| `[CAMERA UPLOAD API]` | `upload/route.ts` |

**How to Use:**
1. Run `npm run dev` to start the development server
2. Trigger camera API calls (upload frames, request frames)
3. Watch the terminal for detailed logs with the prefixes above
4. Filter logs by prefix to focus on specific components

**Example Log Output:**
```
[CAMERA UPLOAD API] ========== POST /api/camera/upload ==========
[CAMERA UPLOAD API] Received upload request
[CAMERA UPLOAD API] cameraId: cam-001
[CAMERA UPLOAD API] imageData present: true
[CAMERA UPLOAD API] imageData length: 45832 chars
[CAMERA UPLOAD API] imageData preview: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...
[CAMERA UPLOAD API] timestamp: 1737820800000
[CAMERA STORE] setFrame called for cameraId: cam-001
[CAMERA STORE] Image data length: 45832 chars
[CAMERA STORE] Timestamp: 1737820800000 (2026-01-25T12:00:00.000Z)
[CAMERA STORE] Frame stored successfully. Total frames in store: 1
[CAMERA UPLOAD API] Frame uploaded and stored successfully
```

---

## Notes

- All logging uses `console.log()` for informational messages and `console.error()` for errors
- Logs are designed to be verbose in development; consider reducing or conditionally enabling in production
- Visual separators (`==========`) help identify the start of new API calls in busy logs

---

### Environment Configuration Setup

**Files Created:**
- `.env.local`

**Purpose:**  
Set up environment variables for API keys and configuration.

**Environment Variables:**
| Variable | Purpose |
|----------|---------|
| `OVERSHOOT_API_KEY` | Server-side Overshoot API key |
| `NEXT_PUBLIC_OVERSHOOT_API_KEY` | Client-side Overshoot API key (used by `useOvershootVision` hook) |

**Note:** The `NEXT_PUBLIC_` prefix is required for Next.js to expose the variable to client-side code.

---

### Overshoot API Key Test Script

**Files Created:**
- `test-overshoot-api.js`

**Purpose:**  
Created a test script to verify that the Overshoot API key is valid and working before using it in the application.

**How to Run:**
```bash
node test-overshoot-api.js
```

**What the Script Tests:**
1. Checks if `OVERSHOOT_API_KEY` is set in `.env.local`
2. Verifies the key is not still the placeholder value
3. Attempts to connect to the Overshoot API (`https://cluster1.overshoot.ai/api/v0.2`)
4. Tests multiple endpoints (`/health`, `/models`, `/account`, `/user`, `/status`) to validate the key
5. Also checks if `NEXT_PUBLIC_OVERSHOOT_API_KEY` is set for client-side usage

**Expected Output (Success):**
```
========================================
  Overshoot API Key Test
========================================

✓ API key found in environment
  Key preview: ovs_313e...45c3
  Key length: 36 characters

Testing API connection...
  Endpoint: https://cluster1.overshoot.ai/api/v0.2

✅ SUCCESS: API key is valid and API is reachable!

========================================
```

**Expected Output (Failure):**
```
❌ FAIL: API key is invalid or unauthorized

Please check:
  1. Your API key is correct
  2. Your API key has not expired
  3. Your account has access to this API
```

---

### Frame Streaming Debug Logging & Testing

**Files Modified:**
- `components/dashboard/VideoFeed.tsx`

**Files Created:**
- `test-frame-streaming.js`

**Purpose:**  
Added comprehensive debug logging to the VideoFeed component to trace the entire frame receiving pipeline, and created a test script to verify the streaming infrastructure.

#### VideoFeed.tsx Logging Additions

**Log Prefix:** `[VIDEO FEED <timestamp>]`

**What Gets Logged:**

| Event | Information Logged |
|-------|-------------------|
| Component mount/unmount | Active state |
| Active state change | New active value |
| Poll requests | Poll number, HTTP status, fetch time, frame availability |
| New frames received | Frame number, time since last frame, image data length/preview |
| Canvas initialization | Width, height, image dimensions |
| Frame drawing | Frame number, image load time, canvas size |
| MediaStream creation | Track details (kind, label, enabled) |
| Errors | Context and error details |

**Logging Frequency:**
- Every 30th poll/frame is logged to avoid console spam (~1 log per second at 30fps)
- First 3 frames are always logged for debugging startup
- All errors are logged immediately

**Example Browser Console Output:**
```
[VIDEO FEED 12:00:00.123] Component MOUNTED { active: false }
[VIDEO FEED 12:00:01.456] Active state changed { active: true }
[VIDEO FEED 12:00:01.457] Activating - starting frame polling
[VIDEO FEED 12:00:01.458] Starting poll interval (33ms / ~30 FPS)
[VIDEO FEED 12:00:01.500] Poll #1 { status: 200, fetchTime: "42.3ms", hasFrame: true, ... }
[VIDEO FEED 12:00:01.510] New frame #1 { timeSinceLastFrame: "0ms", imageDataLength: 45832, ... }
[VIDEO FEED 12:00:01.520] Canvas initialized { width: 1280, height: 720, ... }
[VIDEO FEED 12:00:01.521] Frame #1 drawn to canvas { imgLoadTime: "11.2ms", canvasSize: "1280x720" }
[VIDEO FEED 12:00:01.522] Creating MediaStream from canvas for SDK...
[VIDEO FEED 12:00:01.523] MediaStream created { tracks: [...] }
[VIDEO FEED 12:00:01.524] Calling onStreamReady callback
```

#### test-frame-streaming.js Test Script

**How to Run:**
```bash
# Make sure dev server is running first
npm run dev

# In another terminal
node test-frame-streaming.js
```

**Tests Performed:**
1. **API Connectivity** - Checks if the server is reachable
2. **Single Frame Upload** - Uploads one test frame
3. **Frame Retrieval** - Retrieves the uploaded frame
4. **Frame Freshness** - Checks frame age (should be < 5 seconds)
5. **Streaming Simulation** - Uploads/retrieves 10 frames rapidly
6. **Multiple Camera IDs** - Tests different camera IDs work independently
7. **Default Camera ID** - Verifies "default" camera works (used by VideoFeed)

**Expected Output (Success):**
```
========================================
  Frame Streaming Pipeline Test
========================================

Test 1: API Connectivity
  ✓ API reachable (status: 200)

Test 2: Single Frame Upload
  ✓ Frame uploaded successfully
    Latency: 15.2ms

Test 3: Frame Retrieval
  ✓ Frame retrieved successfully
  ✓ Timestamp matches uploaded frame

...

  ✅ PASS: Frame streaming pipeline is working!
```

**Debugging Tips (included in script output):**
- Check browser console for `[VIDEO FEED]` logs
- Check server terminal for `[CAMERA STORE]` logs
- Verify camera page is sending frames to `/api/camera/upload`
- Ensure cameraId matches between sender and receiver (both should use "default")
- Remember frames expire after 5 seconds

---

### Video Feed Display Bug Fixes

**Files Modified:**
- `components/dashboard/VideoFeed.tsx`
- `app/dashboard/page.tsx`

**Purpose:**  
Fixed issues preventing the camera stream from displaying in the VideoFeed component.

#### Issues Identified & Fixed:

**1. Missing Dependency in useEffect (VideoFeed.tsx)**
- **Problem:** The `hasCamera` state was used inside `pollForFrames` but wasn't in the useEffect dependency array, causing stale closure issues.
- **Fix:** Added `hasCamera` to the dependency array.

**2. Canvas Had No Initial Dimensions (VideoFeed.tsx)**
- **Problem:** The canvas started with 0x0 dimensions and only got sized on first frame load. An unsized canvas displays nothing.
- **Fix:** Added explicit `width={1280}` and `height={720}` attributes to the canvas element, plus `objectFit: 'cover'` for proper scaling.

**3. Video Timing Issue (dashboard/page.tsx)**
- **Problem:** The frame capture loop started before the video element had loaded metadata, so `videoWidth`/`videoHeight` were 0.
- **Fix:** Added `waitForVideo()` function that waits for `loadedmetadata` event before starting frame capture.

**4. Added Dashboard Logging (dashboard/page.tsx)**
- Added `[DASHBOARD]` prefixed console logs throughout the camera streaming logic to trace:
  - Camera access request and grant
  - Video metadata loading
  - Canvas dimension setup
  - Frame capture and upload (every 30th frame)

**Code Changes Summary:**

```tsx
// VideoFeed.tsx - Canvas now has initial dimensions
<canvas 
  ref={canvasRef} 
  width={1280}
  height={720}
  style={{ 
    objectFit: 'cover',
    // ...
  }}
/>

// VideoFeed.tsx - Fixed dependency array
}, [active, onStreamReady, hasCamera])

// dashboard/page.tsx - Wait for video before capture
const waitForVideo = () => {
  return new Promise<void>((resolve) => {
    if (video.videoWidth && video.videoHeight) {
      resolve()
      return
    }
    video.onloadedmetadata = () => resolve()
    video.play().catch(() => {})
  })
}
await waitForVideo()
```

**New Dashboard Logs:**
| Log Message | Meaning |
|-------------|---------|
| `[DASHBOARD] Starting camera streaming...` | Monitoring activated |
| `[DASHBOARD] Requesting camera access...` | getUserMedia called |
| `[DASHBOARD] Camera access granted` | Stream obtained |
| `[DASHBOARD] Video metadata loaded` | Video dimensions available |
| `[DASHBOARD] Canvas dimensions set` | Ready to capture |
| `[DASHBOARD] Frame #N uploaded` | Every 30th frame (success) |

---

### Clerk Authentication Integration

**Files Modified:**
- `app/layout.tsx`
- `app/page.tsx`
- `middleware.ts` (renamed from `proxy.ts`)

**Files Removed:**
- `components/LoginForm.tsx` (no longer needed - replaced by Clerk)

**Purpose:**  
Replaced the placeholder login form with Clerk authentication service for real user authentication, connected to a Neon database.

#### Changes Made:

**1. Layout.tsx - Added ClerkProvider and Auth Header**
- Wrapped entire app with `<ClerkProvider>` for auth context
- Added header with conditional rendering based on auth state:
  - **Signed Out:** Shows "Sign In" and "Sign Up" buttons
  - **Signed In:** Shows `<UserButton />` (avatar with dropdown)

**2. Page.tsx - Replaced LoginForm with Clerk Components**
- Removed import of custom `LoginForm` component
- Added `<SignedOut>` block with Clerk sign-in/sign-up buttons
- Added `<SignedIn>` block with "Go to Dashboard" link

**3. Middleware.ts - Route Protection**
- Renamed from `proxy.ts` to `middleware.ts` (required for Next.js)
- Added route protection for `/dashboard(.*)` using `createRouteMatcher`
- Unauthenticated users accessing `/dashboard` are redirected to sign-in

**Environment Variables Required:**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

---

### Multi-User Twilio SMS Alert System

**Files Created:**
- `lib/db/users.ts` - Database queries for user data
- `lib/db/alerts.ts` - Database queries for alert records
- `lib/db/sync-user.ts` - Sync Clerk users to Neon database
- `lib/twilio.ts` - New Twilio service with multi-user support
- `migrations/011_alert_records_enhancements.sql` - Database migration

**Files Modified:**
- `app/api/sms/alert/route.ts` - Updated to support multi-user alerts

**Purpose:**  
Replaced the single-recipient hardcoded SMS alert system with a multi-user system that fetches phone numbers from the Neon database. Each user can now receive personalized alerts based on their preferences.

#### Problems Solved:

| Issue | Before | After |
|-------|--------|-------|
| Single recipient | `TWILIO_TO_NUMBER` env var | Fetches from `users` table |
| No user preferences | Everyone gets all alerts | Respects `sms_alerts_enabled` and `alert_threshold` |
| In-memory state | Cooldown resets on restart | Cooldown stored in `alert_records` |
| No audit trail | Alerts not logged | All alerts logged with status |
| No Clerk integration | Manual phone numbers | Auto-syncs from Clerk |

#### New Files Explained:

**1. `lib/db/users.ts`** - User Database Queries
```typescript
// Key functions:
getUserByClerkId(clerkId)      // Get user by Clerk ID
getUserById(userId)             // Get user by internal UUID
getUsersForAlert(severity)      // Get all users eligible for an alert
updateUserPhoneNumber(...)      // Update phone number
updateUserAlertPreferences(...) // Update SMS/email preferences
```

**2. `lib/db/alerts.ts`** - Alert Records Queries
```typescript
// Key functions:
logAlert(alert)                 // Log an alert to database
getLastAlertTime(userId)        // For cooldown calculations
isUserInCooldown(userId, ms)    // Check if user is in cooldown
getRecentAlerts(userId, limit)  // Get user's recent alerts
getAlertStats(userId, days)     // Get alert statistics
```

**3. `lib/db/sync-user.ts`** - Clerk to Neon Sync
```typescript
// Key functions:
syncCurrentUser()               // Sync logged-in user to database
getUserIdFromClerk(clerkId)     // Convert Clerk ID to internal ID
ensureUserExists(clerkId, email)// Create user if not exists
```

**4. `lib/twilio.ts`** - Multi-User Twilio Service
```typescript
// Key functions:
sendAlert(options)              // Send to all eligible users
sendDirectSMS(to, body, userId) // Send to specific number
checkGlobalCooldown()           // Check system-wide cooldown

// Options for sendAlert:
{
  severity: 'WARNING' | 'DANGER',
  message: string,
  description?: string,
  cameraId?: string,
  clerkId?: string  // Optional: send to specific user only
}
```

#### Alert Flow Diagram:

```
Danger Detected
      │
      ▼
┌─────────────────────┐
│ POST /api/sms/alert │
│   dangerLevel       │
│   description       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check consecutive   │
│ danger count >= 3   │
└──────────┬──────────┘
           │ Yes
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ getUsersForAlert()  │────▶│  Neon Database      │
│ (from lib/twilio)   │     │  users table        │
└──────────┬──────────┘     └─────────────────────┘
           │
           ▼
    For each user:
           │
           ▼
┌─────────────────────┐
│ Check:              │
│ - sms_alerts_enabled│
│ - has phone_number  │
│ - alert_threshold   │
│ - cooldown period   │
└──────────┬──────────┘
           │ Pass
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Twilio API          │────▶│ SMS to user's phone │
│ messages.create()   │     └─────────────────────┘
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ logAlert()          │────▶│ alert_records table │
└─────────────────────┘     └─────────────────────┘
```

#### Database Migration (011):

Adds columns to `alert_records`:
- `user_id` - Links to users table
- `phone_number` - Number alert was sent to
- `twilio_sid` - Twilio message ID
- `status` - sent/failed/skipped/cooldown

#### Environment Variables:

```env
# Existing (still required)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890

# New feature flag (enable multi-user system)
USE_MULTI_USER_ALERTS=true

# Can remove (no longer needed with multi-user)
# TWILIO_TO_NUMBER=+1234567890
```

#### How to Enable:

1. Run the migration:
   ```bash
   node migrations/run-migrations.js
   ```

2. Add the feature flag to `.env.local`:
   ```env
   USE_MULTI_USER_ALERTS=true
   ```

3. Ensure users have phone numbers in the database (synced from Clerk or manually added)

4. Users can configure their preferences:
   - `sms_alerts_enabled`: true/false
   - `alert_threshold`: 'WARNING' or 'DANGER'

---

### SMS System Simplification (Final Implementation)

**Date:** January 25, 2026

**Files Modified:**
- `lib/twilio.ts` - Completely rewritten for simplified flow
- `app/api/sms/alert/route.ts` - Updated to use new sendAlert signature

**Purpose:**  
Simplified the multi-user SMS system to work within Twilio trial account limitations (5 verified phone numbers). The system now queries the Neon database directly for eligible users without complex dependency chains.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     SMS ALERT FLOW                              │
│                                                                 │
│  1. Threat Detected (Overshoot AI)                             │
│            ↓                                                    │
│  2. POST /api/sms/alert                                        │
│            ↓                                                    │
│  3. Check consecutive danger count (≥3 required)               │
│            ↓                                                    │
│  4. sendAlert(severity, message)                               │
│            ↓                                                    │
│  5. Query Neon DB for eligible users:                          │
│     - sms_alerts_enabled = true                                │
│     - phone_number IS NOT NULL                                 │
│     - severity matches alert_threshold                         │
│            ↓                                                    │
│  6. Send SMS to each user via Twilio                           │
│            ↓                                                    │
│  7. Return results with status per user                        │
└─────────────────────────────────────────────────────────────────┘
```

**Key Simplifications:**

1. **Direct Database Query** - No complex helper imports, uses `lib/db.ts` directly
2. **In-Memory Cooldown** - Simple timestamp-based cooldown (1 minute global)
3. **No Per-User Cooldown** - Simplified to global cooldown for trial account
4. **Removed Dependencies** - No longer imports from `lib/db/users.ts`, `lib/db/alerts.ts`
5. **Cleaner Function Signature** - `sendAlert(severity, message)` instead of options object


**New Exports from `lib/twilio.ts`:**
- `sendAlert(severity, message)` - Main function to send alerts
- `sendDirectSMS(to, body)` - Send SMS to specific number
- `isInCooldown()` - Check if cooldown is active
- `getCooldownRemaining()` - Get seconds remaining in cooldown
- `twilioClient` - Raw Twilio client for advanced usage

**Security Model:**
- Only users in the Neon database receive SMS
- Database access protected by `DATABASE_URL` secret
- Twilio trial limits to 5 verified phone numbers
- Eligible users data pre-populated in database

**Testing:**
```bash
# Enable multi-user mode
echo "USE_MULTI_USER_ALERTS=true" >> .env.local

# Test the alert endpoint
curl -X POST http://localhost:3000/api/sms/alert \
  -H "Content-Type: application/json" \
  -d '{"dangerLevel": "DANGER", "description": "Test alert"}'
```

**Expected Console Output:**
```
[SMS ALERT API] ====== REQUEST RECEIVED ======
[SMS ALERT API] Danger level: DANGER
[SMS ALERT API] Multi-user mode: true
[TWILIO] ====== SEND ALERT START ======
[TWILIO] Querying database for eligible users, severity: DANGER
[TWILIO] Found 2 eligible users:
  - User 1 (+1234567890)
  - User 2 (+0987654321)
[TWILIO] Sending to User 1 at +1234567890
[TWILIO] ✓ SMS sent to User 1, SID: SM123...
[TWILIO] Sending to User 2 at +0987654321
[TWILIO] ✓ SMS sent to User 2, SID: SM456...
[TWILIO] ====== SEND ALERT COMPLETE ======
[TWILIO] Sent: 2, Failed: 0, Total: 2
```

---

*Last Updated: January 25, 2026*
