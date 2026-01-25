# Mapbox Geocoding API Setup

## Overview

This application uses Mapbox Geocoding API for accurate address-level reverse geocoding (converting coordinates to addresses). Mapbox provides building-level precision and is free up to 100,000 requests per month.

## Setup Instructions

### 1. Get a Mapbox Access Token

1. Go to [https://account.mapbox.com/](https://account.mapbox.com/)
2. Sign up for a free account (or sign in if you already have one)
3. Navigate to your account's **Access Tokens** page
4. Copy your **Default Public Token** (starts with `pk.`)

### 2. Add Token to Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
```

**Important**: The token must start with `NEXT_PUBLIC_` so it's available on the client side.

### 3. Verify Setup

After adding the token, restart your Next.js dev server:

```bash
npm run dev
```

The application will automatically use Mapbox for reverse geocoding. If the token is not configured, it will fall back to Nominatim (OpenStreetMap).

## How It Works

### Reverse Geocoding Flow

1. **User grants location permission** → Browser geolocation provides coordinates
2. **Coordinates sent to `/api/geocode/reverse`** → API route handles geocoding
3. **Mapbox API called first** (if token configured) → Returns detailed address
4. **Nominatim fallback** (if Mapbox fails or not configured) → Free alternative

### API Route: `/api/geocode/reverse`

**Request:**
```
GET /api/geocode/reverse?lat=43.4833&lng=-80.5408
```

**Response:**
```json
{
  "success": true,
  "source": "mapbox",
  "address": {
    "full": "295 Lester Street, Waterloo, ON N2L 0B9, Canada",
    "street": "295 Lester Street",
    "streetNumber": "295",
    "streetName": "Lester Street",
    "city": "Waterloo",
    "state": "Ontario",
    "postalCode": "N2L 0B9",
    "country": "Canada"
  },
  "coordinates": {
    "lat": 43.4833,
    "lng": -80.5408
  },
  "accuracy": "address-level"
}
```

## Mapbox Pricing

- **Free Tier**: 100,000 requests/month
- **After Free Tier**: $0.75 per 1,000 requests
- **No credit card required** for free tier

## Accuracy Comparison

| Service | Accuracy | Cost |
|---------|----------|------|
| **Mapbox** | Building-level (3-10m) | Free (100k/month) |
| Nominatim | Street-level (10-50m) | Free (unlimited) |
| Google Maps | Building-level (3-5m) | Paid ($5/1k) |

## Fallback Behavior

If Mapbox is unavailable or not configured:
- Automatically falls back to Nominatim (OpenStreetMap)
- No errors shown to user
- Address still displayed (may be less precise)

## Testing

To test the geocoding:

1. Navigate to `/mappreview` or the dashboard
2. Allow location access
3. Check browser console for logs:
   - `[Reverse Geocode API] Trying Mapbox...`
   - `[Reverse Geocode API] Mapbox success:` (if token configured)
   - `[Reverse Geocode API] Trying Nominatim fallback...` (if Mapbox fails)

## Troubleshooting

### Mapbox not working

1. **Check token**: Verify `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is in `.env.local`
2. **Restart server**: Environment variables require server restart
3. **Check token format**: Should start with `pk.`
4. **Check console**: Look for `[Reverse Geocode API]` logs

### Address not accurate enough

- Mapbox provides building-level accuracy
- If still inaccurate, check:
  - GPS signal strength (indoor vs outdoor)
  - Browser geolocation accuracy settings
  - Device GPS capabilities

## Additional Resources

- [Mapbox Geocoding API Docs](https://docs.mapbox.com/api/search/geocoding/)
- [Mapbox Account Dashboard](https://account.mapbox.com/)
- [Mapbox Pricing](https://www.mapbox.com/pricing/)
