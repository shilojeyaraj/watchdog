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
