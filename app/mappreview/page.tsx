"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"

// Import Leaflet CSS and fix marker icon paths - must be done client-side
if (typeof window !== "undefined") {
  import("leaflet/dist/leaflet.css").catch((err) => {
    console.error("[MapPreview] Failed to load Leaflet CSS:", err)
  })
  
  // Fix Leaflet marker icon paths for Next.js (common issue)
  import("leaflet").then((L) => {
    delete (L.default.Icon.Default.prototype as any)._getIconUrl
    L.default.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    })
  }).catch((err) => {
    console.error("[MapPreview] Failed to fix Leaflet icons:", err)
  })
}

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center">Loading map...</div> }
)

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
)

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
)

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
)

// No default - must get location dynamically
const DEFAULT_ZOOM = 15

export default function MapPreviewPage() {
  const [isClient, setIsClient] = useState(false)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [address, setAddress] = useState<string>("Getting address...")
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const positionReadingsRef = useRef<Array<{ lat: number; lng: number; accuracy: number; timestamp: number }>>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Request location on mount with IP fallback
  useEffect(() => {
    if (!isClient) return

    const getLocation = async () => {
      if (navigator.geolocation) {
        console.log("[MapPreview] Requesting high-accuracy browser geolocation...")
        
        // Clear any existing watch
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        
        // Reset position readings
        positionReadingsRef.current = []
        
        // Helper function for reverse geocoding
        const reverseGeocode = (lat: number, lng: number) => {
          console.log("[MapPreview] 📍 Requesting reverse geocode for coordinates:", { lat, lng })
          
          fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
            .then((res) => {
              console.log("[MapPreview] Reverse geocode API response status:", {
                status: res.status,
                statusText: res.statusText,
                ok: res.ok
              })
              return res.json()
            })
            .then((data) => {
              console.log("[MapPreview] Reverse geocode API response data:", {
                success: data.success,
                source: data.source,
                accuracy: data.accuracy,
                hasAddress: !!data.address,
                addressKeys: data.address ? Object.keys(data.address) : []
              })
              
              if (data.success && data.address) {
                const addr = data.address
                const fullAddress = addr.full || [
                  addr.streetNumber,
                  addr.streetName,
                  addr.city,
                  addr.state,
                  addr.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")
                
                console.log("[MapPreview] ✅ Address resolved successfully:", {
                  full: fullAddress,
                  source: data.source,
                  accuracy: data.accuracy,
                  street: addr.street,
                  streetNumber: addr.streetNumber,
                  streetName: addr.streetName,
                  city: addr.city,
                  state: addr.state,
                  postalCode: addr.postalCode,
                  country: addr.country
                })
                
                setAddress(fullAddress || `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
              } else {
                console.warn("[MapPreview] ⚠️ Reverse geocode returned no address:", {
                  success: data.success,
                  error: data.error,
                  data: data
                })
                setAddress(`Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
              }
            })
            .catch((err) => {
              console.error("[MapPreview] ❌ Reverse geocode fetch error:", {
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined
              })
              setAddress(`Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
            })
        }
        
        // Helper function for IP geolocation fallback
        const fallbackToIPGeolocation = async () => {
          try {
            const response = await fetch('/api/geolocation')
            const data = await response.json()
            
            if (data.success && data.lat && data.lng) {
              console.log("[MapPreview] IP geolocation success:", {
                lat: data.lat,
                lng: data.lng,
                accuracy: `${data.accuracy}m`,
                source: data.source
              })
              setUserLocation([data.lat, data.lng])
              setLocationAccuracy(data.accuracy)
              reverseGeocode(data.lat, data.lng)
            } else {
              console.error("[MapPreview] IP geolocation also failed")
            }
          } catch (error) {
            console.error("[MapPreview] IP geolocation error:", error)
          }
        }
        
        // Use watchPosition for continuous updates (better accuracy over time)
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude
            const lng = position.coords.longitude
            const accuracy = position.coords.accuracy
            
            console.log("[MapPreview] Geolocation update:", { 
              lat, 
              lng, 
              accuracy: `${accuracy.toFixed(0)}m`,
              timestamp: Date.now()
            })
            
            // Store reading
            positionReadingsRef.current.push({
              lat,
              lng,
              accuracy,
              timestamp: Date.now()
            })
            
            // Keep only last 10 readings (last ~30 seconds if updating every 3s)
            if (positionReadingsRef.current.length > 10) {
              positionReadingsRef.current.shift()
            }
            
            // Strategy: Wait for high accuracy OR average multiple readings
            // Accept position if accuracy < 50m (good GPS)
            // OR if we have 3+ readings and average them (improves accuracy)
            if (accuracy < 50) {
              console.log("[MapPreview] ✅ High accuracy achieved:", { accuracy: `${accuracy.toFixed(0)}m` })
              
              // Clear watch and use this position
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
                watchIdRef.current = null
              }
              
              setUserLocation([lat, lng])
              setLocationAccuracy(accuracy)
              reverseGeocode(lat, lng)
            } else if (positionReadingsRef.current.length >= 3) {
              // Average the last 3 readings for better accuracy
              const recentReadings = positionReadingsRef.current.slice(-3)
              const avgLat = recentReadings.reduce((sum, p) => sum + p.lat, 0) / recentReadings.length
              const avgLng = recentReadings.reduce((sum, p) => sum + p.lng, 0) / recentReadings.length
              const avgAccuracy = recentReadings.reduce((sum, p) => sum + p.accuracy, 0) / recentReadings.length
              
              console.log("[MapPreview] 📊 Averaging readings:", {
                count: recentReadings.length,
                avgLat: avgLat.toFixed(6),
                avgLng: avgLng.toFixed(6),
                avgAccuracy: `${avgAccuracy.toFixed(0)}m`,
                individualAccuracies: recentReadings.map(p => `${p.accuracy.toFixed(0)}m`)
              })
              
              // Use averaged position if it's better than current
              if (!userLocation || avgAccuracy < (locationAccuracy || Infinity)) {
                setUserLocation([avgLat, avgLng])
                setLocationAccuracy(avgAccuracy)
                reverseGeocode(avgLat, avgLng)
              }
            } else {
              // Still collecting readings, show best so far
              const bestReading = positionReadingsRef.current.reduce((best, current) => 
                current.accuracy < best.accuracy ? current : best
              )
              
              if (!userLocation || bestReading.accuracy < (locationAccuracy || Infinity)) {
                setUserLocation([bestReading.lat, bestReading.lng])
                setLocationAccuracy(bestReading.accuracy)
                
                // Only reverse geocode if accuracy is reasonable
                if (bestReading.accuracy < 1000) {
                  reverseGeocode(bestReading.lat, bestReading.lng)
                }
              }
            }
          },
          (error) => {
            console.warn("[MapPreview] Browser geolocation error:", error)
            
            // Clear watch on error
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current)
              watchIdRef.current = null
            }
            
            // If we have any readings, use the best one
            if (positionReadingsRef.current.length > 0) {
              const bestReading = positionReadingsRef.current.reduce((best, current) => 
                current.accuracy < best.accuracy ? current : best
              )
              console.log("[MapPreview] Using best reading from collected positions:", {
                lat: bestReading.lat,
                lng: bestReading.lng,
                accuracy: `${bestReading.accuracy.toFixed(0)}m`
              })
              setUserLocation([bestReading.lat, bestReading.lng])
              setLocationAccuracy(bestReading.accuracy)
              reverseGeocode(bestReading.lat, bestReading.lng)
            } else {
              // Fallback to IP geolocation
              fallbackToIPGeolocation()
            }
          },
          {
            enableHighAccuracy: true, // Request GPS if available
            timeout: 30000, // 30 second timeout
            maximumAge: 0, // Don't use cached positions
          }
        )
        
        // Set a timeout to stop watching after 30 seconds and use best reading
        setTimeout(() => {
          if (watchIdRef.current !== null) {
            console.log("[MapPreview] ⏱️ Geolocation timeout - using best reading collected")
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
            
            if (positionReadingsRef.current.length > 0) {
              const bestReading = positionReadingsRef.current.reduce((best, current) => 
                current.accuracy < best.accuracy ? current : best
              )
              setUserLocation([bestReading.lat, bestReading.lng])
              setLocationAccuracy(bestReading.accuracy)
              reverseGeocode(bestReading.lat, bestReading.lng)
            } else {
              fallbackToIPGeolocation()
            }
          }
        }, 30000)
      } else {
        // No geolocation support - use IP only
        console.log("[MapPreview] Browser geolocation not supported, using IP-based...")
        fallbackToIPGeolocation()
      }
    }

    getLocation()
    
    // Cleanup watch on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isClient])

  // Set map loaded when location is ready
  useEffect(() => {
    if (userLocation && isClient && containerRef.current) {
      // Small delay to ensure container is ready
      setTimeout(() => {
        setMapLoaded(true)
        console.log("[MapPreview] Map ready to load")
      }, 300)
    }
  }, [userLocation, isClient])

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  // Don't render map until we have a location
  if (!userLocation) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Getting your location...</p>
          <p className="text-sm text-gray-600">Please allow location access or wait for IP-based location.</p>
        </div>
      </div>
    )
  }

  const mapCenter = userLocation

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Map Preview - Leaflet Test</h1>
        <p className="text-sm text-gray-600 mb-4">
          This page only displays the map to verify Leaflet is working correctly.
        </p>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm font-semibold text-blue-900 mb-1">📍 Current Address:</p>
          <p className="text-sm text-blue-800">{address}</p>
          {locationAccuracy !== null && (
            <p className="text-xs text-blue-600 mt-1">
              Location accuracy: {locationAccuracy < 50 ? (
                <span className="text-green-600 font-semibold">Excellent ({locationAccuracy.toFixed(0)}m)</span>
              ) : locationAccuracy < 100 ? (
                <span className="text-green-600">Good ({locationAccuracy.toFixed(0)}m)</span>
              ) : locationAccuracy < 500 ? (
                <span className="text-yellow-600">Fair ({locationAccuracy.toFixed(0)}m)</span>
              ) : (
                <span className="text-red-600">Poor ({locationAccuracy.toFixed(0)}m) - Try moving to an area with better GPS signal</span>
              )}
            </p>
          )}
        </div>
        <div
          ref={containerRef}
          className="w-full"
          style={{
            height: "600px",
            width: "100%",
            position: "relative",
            zIndex: 1,
            overflow: "visible",
            backgroundColor: "#e8e8e8",
            border: "2px solid #000",
            borderRadius: "8px",
          }}
          id="map-preview-container"
        >
          {mapLoaded ? (
            <MapContainer
              center={mapCenter}
              zoom={DEFAULT_ZOOM}
              style={{ 
                height: "100%", 
                width: "100%", 
                zIndex: 1,
                position: "relative"
              }}
              scrollWheelZoom={true}
              className="leaflet-container-custom"
              whenCreated={(map) => {
                const center = map.getCenter()
                const zoom = map.getZoom()
                
                console.log("[MapPreview] ===== MAP CREATED =====")
                console.log("[MapPreview] Map center (lat, lng):", {
                  lat: center.lat,
                  lng: center.lng,
                  formatted: `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`
                })
                console.log("[MapPreview] Map zoom level:", zoom)
                console.log("[MapPreview] Expected location:", {
                  expected: mapCenter,
                  formatted: `${mapCenter[0].toFixed(6)}, ${mapCenter[1].toFixed(6)}`
                })
                
                // IMPORTANT: Leaflet uses [lat, lng] format
                // Check if coordinates might be swapped
                if (Math.abs(center.lat - mapCenter[0]) > 0.1 || Math.abs(center.lng - mapCenter[1]) > 0.1) {
                  console.warn("[MapPreview] ⚠️ COORDINATE MISMATCH!")
                  console.warn("[MapPreview] Expected:", mapCenter)
                  console.warn("[MapPreview] Actual:", [center.lat, center.lng])
                  console.warn("[MapPreview] If coordinates are swapped, Leaflet expects [latitude, longitude]")
                }
                
                // Force invalidateSize to ensure tiles load
                setTimeout(() => {
                  map.invalidateSize()
                  
                  // Check tiles and their URLs
                  const container = map.getContainer()
                  const tiles = container.querySelectorAll('.leaflet-tile-container img')
                  console.log("[MapPreview] ===== TILE INFORMATION =====")
                  console.log("[MapPreview] Number of tiles loaded:", tiles.length)
                  
                  if (tiles.length > 0) {
                    // Extract tile coordinates from URLs
                    // URL format: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
                    const tileInfo: Array<{ url: string; z: number; x: number; y: number }> = []
                    
                    tiles.forEach((tile, idx) => {
                      const tileEl = tile as HTMLImageElement
                      const url = tileEl.src
                      
                      // Extract z, x, y from URL
                      const match = url.match(/\/\/(\d+)\/(\d+)\/(\d+)\.png/)
                      if (match) {
                        const [, z, x, y] = match.map(Number)
                        tileInfo.push({ url, z, x, y })
                      }
                      
                      if (idx < 3) { // Log first 3 tiles
                        console.log(`[MapPreview] Tile ${idx}:`, {
                          url: url.substring(0, 80) + '...',
                          complete: tileEl.complete,
                          naturalWidth: tileEl.naturalWidth,
                          naturalHeight: tileEl.naturalHeight,
                        })
                      }
                    })
                    
                    if (tileInfo.length > 0) {
                      console.log("[MapPreview] Tile coordinates (z/x/y):", tileInfo.slice(0, 5))
                      console.log("[MapPreview] Zoom level from tiles:", tileInfo[0]?.z)
                      console.log("[MapPreview] Tile X range:", {
                        min: Math.min(...tileInfo.map(t => t.x)),
                        max: Math.max(...tileInfo.map(t => t.x))
                      })
                      console.log("[MapPreview] Tile Y range:", {
                        min: Math.min(...tileInfo.map(t => t.y)),
                        max: Math.max(...tileInfo.map(t => t.y))
                      })
                    }
                  }
                  
                  // Verify map center matches what we set
                  const currentCenter = map.getCenter()
                  console.log("[MapPreview] ===== VERIFICATION =====")
                  console.log("[MapPreview] Current map center:", {
                    lat: currentCenter.lat.toFixed(6),
                    lng: currentCenter.lng.toFixed(6)
                  })
                  console.log("[MapPreview] Expected center:", {
                    lat: mapCenter[0].toFixed(6),
                    lng: mapCenter[1].toFixed(6)
                  })
                  
                  // Check if you can see the location on OpenStreetMap
                  const osmUrl = `https://www.openstreetmap.org/?mlat=${mapCenter[0]}&mlon=${mapCenter[1]}&zoom=${zoom}`
                  console.log("[MapPreview] View this location on OpenStreetMap:", osmUrl)
                }, 500)
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{
                  loading: () => {
                    console.log("[MapPreview] Tiles loading...")
                  },
                  load: () => {
                    console.log("[MapPreview] Tiles loaded successfully")
                  },
                  tileerror: (error: any) => {
                    console.error("[MapPreview] Tile loading error:", error)
                  }
                }}
              />

              {/* User location marker */}
              <Marker position={mapCenter}>
                <Popup>
                  <div>
                    <strong>Your Location</strong>
                    <br />
                    {address}
                    <br />
                    <span className="text-xs text-gray-500">
                      {mapCenter[0].toFixed(6)}, {mapCenter[1].toFixed(6)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Initializing map...</p>
            </div>
          )}
        </div>
        <div className="mt-4 p-4 bg-white rounded border">
          <h2 className="font-semibold mb-2">Debug Info:</h2>
          <ul className="text-sm space-y-1">
            <li>Client loaded: {isClient ? "Yes" : "No"}</li>
            <li>User location: {userLocation ? `${userLocation[0].toFixed(6)}, ${userLocation[1].toFixed(6)}` : "Not set"}</li>
            <li>Location accuracy: {locationAccuracy !== null ? `${locationAccuracy.toFixed(0)}m` : "Unknown"}</li>
            <li>Address: <strong>{address}</strong></li>
            <li>Map loaded: {mapLoaded ? "Yes" : "No"}</li>
            <li>Container ready: {containerRef.current ? "Yes" : "No"}</li>
            <li><strong>Map center (lat, lng):</strong> {mapCenter[0].toFixed(6)}, {mapCenter[1].toFixed(6)}</li>
            <li><strong>Zoom level:</strong> {DEFAULT_ZOOM}</li>
          </ul>
          <div className="mt-3 pt-3 border-t">
            <h3 className="font-semibold mb-1">How Leaflet Works:</h3>
            <ul className="text-xs space-y-1 text-gray-600">
              <li>• Leaflet uses <strong>tile images</strong> from OpenStreetMap</li>
              <li>• Tile URL format: <code className="bg-gray-100 px-1 rounded">https://tile.openstreetmap.org/{`{z}`}/{`{x}`}/{`{y}`}.png</code></li>
              <li>• Coordinates format: <code className="bg-gray-100 px-1 rounded">[latitude, longitude]</code> (lat first!)</li>
              <li>• Check browser console for detailed tile information</li>
            </ul>
          </div>
          <div className="mt-3 pt-3 border-t">
            <a 
              href={`https://www.openstreetmap.org/?mlat=${mapCenter[0]}&mlon=${mapCenter[1]}&zoom=${DEFAULT_ZOOM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              → View this location on OpenStreetMap.org
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
