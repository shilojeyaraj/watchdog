# Maps & Live Map Display Implementation Guide

## 🗺️ Mapping Library Options

### **Leaflet** (Recommended - FREE)
- ✅ **Completely free and open source**
- ✅ No API keys required
- ✅ Lightweight and fast
- ✅ Great documentation
- ✅ Works with OpenStreetMap (free tile provider)
- ✅ Customizable markers and popups
- ✅ Perfect for displaying locations and incidents

### Mapbox (Alternative)
- ⚠️ Free tier: 50,000 map loads/month
- ⚠️ Requires API key
- ✅ Beautiful UI
- ✅ More features (3D, custom styles)

### Google Maps (Alternative)
- ❌ Costs money at scale
- ⚠️ Requires API key and billing
- ✅ Familiar interface

## 🎯 What We'll Build

A **Live Map Display** showing:
1. **Location Markers** - All your locations (buildings, sites)
2. **Incident Markers** - Active incidents with severity colors
3. **Event Markers** - Recent events (optional, can be toggled)
4. **Real-time Updates** - Map updates when new incidents occur
5. **Click for Details** - Click marker to see location/incident details

## 📦 Installation

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

## 🗂️ File Structure

```
components/
  maps/
    LiveMap.tsx          # Main map component
    LocationMarker.tsx   # Marker for locations
    IncidentMarker.tsx   # Marker for incidents
    MapControls.tsx      # Filter controls (show/hide incidents, etc.)
```

## 🚀 Implementation Steps

### Step 1: Install Dependencies

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

### Step 2: Add Leaflet CSS

In `app/globals.css`, add:
```css
@import 'leaflet/dist/leaflet.css';
```

### Step 3: Create API Route for Locations/Incidents

Create `app/api/map/data/route.ts` to fetch:
- All locations with coordinates
- Active incidents with location data
- Recent events (optional)

### Step 4: Create Map Component

Create `components/maps/LiveMap.tsx`:
- Displays map using react-leaflet
- Fetches locations and incidents
- Renders markers
- Updates in real-time (polling or WebSocket)

### Step 5: Add to Dashboard

Add map to dashboard page, either:
- As a new tab/section
- As a side panel
- As a full-page view

## 🎨 Visual Design

**Marker Colors:**
- 🟢 **Green** - Location (no active incidents)
- 🟡 **Yellow** - Location with WARNING incidents
- 🟠 **Orange** - Location with HIGH priority incidents
- 🔴 **Red** - Location with CRITICAL incidents

**Marker Icons:**
- 📍 Standard pin for locations
- ⚠️ Warning icon for incidents
- 🚨 Alert icon for critical incidents

## 📊 Data Flow

```
Database (locations, incidents)
    ↓
API Route (/api/map/data)
    ↓
Map Component (LiveMap.tsx)
    ↓
Leaflet Map Display
    ↓
User Interaction (click markers, filter, etc.)
```

## 🔄 Real-time Updates

**Option 1: Polling** (Simple)
- Poll `/api/map/data` every 5-10 seconds
- Update markers when data changes

**Option 2: WebSocket** (Advanced)
- Use existing Socket.IO server
- Push updates when incidents occur
- More efficient, real-time

## 📍 Example Use Cases

1. **Multi-Site Monitoring**
   - View all locations on one map
   - See which sites have active incidents
   - Click to see details

2. **Incident Response**
   - See incident location on map
   - Get directions to location
   - View nearby cameras

3. **Analytics**
   - Heat map of incident frequency
   - Clustering of nearby locations
   - Time-based filtering

## 🛠️ Next Steps

Would you like me to:
1. ✅ Install Leaflet and create the map components?
2. ✅ Create API route to fetch location/incident data?
3. ✅ Add map to dashboard?
4. ✅ Implement real-time updates?

Let me know and I'll implement the complete solution!
