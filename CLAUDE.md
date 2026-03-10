# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Watchdog is a real-time first-responder security tool. It streams CCTV footage through AI analysis (Overshoot SDK) to detect threats, display person locations on a geospatial map, and send SMS alerts via Twilio.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server (port 3000)
node server.js       # Start custom server with Socket.IO WebSocket support

# Build & lint
npm run build
npm run lint

# Tests
npm test                    # Vitest watch mode
npm run test:run            # Single run (CI)
npm run test:coverage       # Run with v8 coverage report
# Run a specific file:
npx vitest run __tests__/unit/smsState.test.ts

# Database
npm run migrate           # Run pending DB migrations
npm run migrate:status    # Check applied migrations
npm run db:test           # Test PostgreSQL connection

# Manual SMS testing
node -e "require('./app/sms/automated_message.js').sendTestMessage()"
node scripts/test-sms-user-alert.js   # Test user-specific alert flow (requires DB)
node scripts/test-db-users.js         # Verify user records in Neon

# Inspect/reset SMS alert state
cat .sms-state.json
rm .sms-state.json
```

## Architecture

### Two-Device Flow
The app supports a camera device (streams webcam via Socket.IO) and a dashboard device (receives feed, analyzes, alerts). `server.js` is the custom HTTP+Socket.IO server - use `node server.js` instead of `npm run dev` when WebSocket video streaming between two devices is needed.

### Core Data Pipeline
```
Camera (webcam) → POST /api/camera/upload (base64 JPEG frames)
               → /api/camera/frame (retrieve latest frame)
               → useOvershootVision hook (polls Overshoot AI ~1-2s)
               → dangerLevel: SAFE | WARNING | DANGER + 10×10 boolean grid
               → POST /api/sms/alert (trigger SMS via Twilio)
               → EventMap component (render locations on Leaflet map)
```

### Key Files

| Path | Purpose |
|------|---------|
| `app/overshoot/useOvershootVision.ts` | **Canonical** AI polling hook - do not duplicate its loop |
| `app/overshoot/types.ts` | `DangerLevel`, `OvershootParsed`, `OvershootResult` types |
| `app/sms/smsState.ts` | SMS alert state machine (disk I/O, consecutive-event counting) |
| `app/sms/automated_message.js` | Legacy Twilio wrapper (env-var target number) |
| `lib/twilio.ts` | **Current** Twilio module - user-specific alerts with DB lookup, cooldown, threshold |
| `lib/db/users.ts` | User alert preferences (`getUserByClerkId`, `getUsersForAlert`, `updateUserAlertPreferences`) |
| `lib/db/alerts.ts` | Alert audit log (`logAlert`, `isUserInCooldown`, `getAlertStats`) |
| `lib/db/sync-user.ts` | Upserts Clerk user into Neon on every dashboard load (`syncCurrentUser`) |
| `app/api/sms/alert/route.ts` | Receives danger events from frontend, triggers SMS |
| `app/api/sms/incoming/route.ts` | Twilio webhook for inbound SMS replies |
| `app/api/camera/store.ts` | In-memory store for latest camera frame |
| `app/dashboard/layout.tsx` | Calls `syncCurrentUser()` server-side on every dashboard request |
| `app/dashboard/page.tsx` | Main dashboard - orchestrates hooks, video, map |
| `components/dashboard/EventMap.tsx` | Leaflet map with browser/IP geolocation and grid overlay |
| `server.js` | Express+Socket.IO server wrapping Next.js |

### SMS Alert System
Two parallel SMS paths exist:
1. **Legacy** (`app/sms/automated_message.js` + `.sms-state.json`): Sends to `TWILIO_TO_NUMBER` env var; state machine fires after 3 consecutive DANGER events, once per 60s. State reads/writes go through `app/sms/smsState.ts` - never `fs` directly.
2. **User-specific** (`lib/twilio.ts`): Looks up the authenticated Clerk user in Neon DB, checks `sms_alerts_enabled`, `phone_number`, and `alert_threshold` before sending. Cooldown tracked in-memory (60s). Alert records logged to `alert_records` table via `lib/db/alerts.ts`.

### User Sync
`app/dashboard/layout.tsx` runs `syncCurrentUser()` (server component) on every request, upserting Clerk user data into the `users` table. This ensures SMS preferences are always present before alerts fire. Per-user preferences (`sms_alerts_enabled`, `alert_threshold`, `phone_number`) are stored in `users` and read by `lib/twilio.ts`.

### API Conventions
- All API routes use Next.js App Router (`app/api/**/route.ts`)
- Success: `{ success: true, message: string, data?: any }`
- Error: `{ error: string, details?: string }`
- `/api/sms/incoming` must always return HTTP 200 (prevents Twilio retry loops) and must never require auth
- SMS sends are non-blocking - don't `await` Twilio inside the response path

### Leaflet / SSR
All Leaflet/react-leaflet components must be loaded via `dynamic(..., { ssr: false })`. The map requires browser geolocation (falls back to `/api/geolocation` IP-based). Person grid cells are mapped to lat/lng offsets of ~100m per cell (`GRID_TO_MAP_OFFSET = 0.0009`).

### Auth
Clerk is used for auth (`@clerk/nextjs`). Dashboard requires sign-in; redirect handled in `app/dashboard/page.tsx`. Webhooks at `/api/webhooks/clerk`.

## Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_OVERSHOOT_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=      # Your Twilio number
TWILIO_TO_NUMBER=        # Recipient phone number
DATABASE_URL=            # PostgreSQL connection string
```

## TypeScript Style

- `camelCase` for variables/functions, `PascalCase` for types/components, `UPPER_SNAKE_CASE` for constants
- Prefer explicit interfaces for API request/response types; avoid `any` (use `unknown` + type guards)
- Use early returns over nested conditions

---

## Frontend / UI

### Stack
- **Styling:** Tailwind CSS - never inline `style={{}}`, never hardcode hex values, never arbitrary values (`w-[347px]`) unless unavoidable
- **Components:** shadcn/ui as the base primitive layer
- **Premium components:** [21st.dev](https://21st.dev) - check here first before building any common UI pattern from scratch (navbars, cards, modals, tabs, sidebars, inputs, tables, etc.)
- **Animation:** Framer Motion
- **Icons:** Lucide React

### 21st.dev Workflow
Install components via the shadcn CLI:
```bash
npx shadcn@latest add "https://21st.dev/r/[component-slug]"
```
All 21st.dev components are TypeScript-first, Tailwind-styled, Radix UI accessible, and fully owned after install. Always verify the exact slug on 21st.dev before running.

If no 21st.dev component exists for a pattern, build it in the same style: shadcn/ui conventions, Tailwind classes, TypeScript props, `cn()` for class merging.

### Design Direction
The Watchdog aesthetic is **high-contrast tactical** - think command centre, not SaaS dashboard:
- Dark-first, strong typographic hierarchy, deliberate whitespace
- No purple gradients, no generic AI aesthetics, no cookie-cutter card layouts
- Every interactive element needs explicit hover, focus, and active states
- Use `hsl(var(--token))` CSS variables for all colours - never hardcode

### Component Rules
- Break pages into small, focused, reusable components - no monolithic page files
- All components: named exports, kebab-case filenames, PascalCase component names, fully typed props
- Use `cn()` from `@/lib/utils` for all conditional class merging
- File locations: `components/` for feature components, `components/ui/` for primitives

### Responsiveness
- Mobile-first: design for 375 px, scale up with `sm:` / `md:` / `lg:` / `xl:`
- Navigation must collapse gracefully on mobile

### Accessibility
- Semantic HTML (`<nav>`, `<main>`, `<section>`, `<button>`) - never `<div>` for interactive elements
- All interactive elements keyboard-accessible
- WCAG AA colour contrast minimum
- Form inputs must have associated `<label>` elements

### Dark Mode
- All UI must work in both light and dark mode via Tailwind `dark:` prefix and shadcn/ui CSS variables
- Test every component in both modes

### Performance
- Lazy-load heavy components with `React.lazy()` + `Suspense`
- Use `next/image` for all images
- Use `useMemo` / `useCallback` where re-renders are a concern
