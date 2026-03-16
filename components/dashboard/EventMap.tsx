"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
// Card removed — using dark glass panel

// Fix Leaflet marker icon paths for Next.js (common issue) - must be done client-side
// Note: Leaflet CSS is already imported in app/globals.css
if (typeof window !== "undefined") {
  import("leaflet").then((L) => {
    delete (L.default.Icon.Default.prototype as any)._getIconUrl
    L.default.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    })
  }).catch((err) => {
    console.error("[EventMap] Failed to fix Leaflet icons:", err)
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

interface EventMapProps {
  grid?: (string | null)[][]
  isMonitoring?: boolean
}

// No default location - must get location dynamically
const DEFAULT_ZOOM = 18 // Building-level zoom

// Convert grid coordinates to map offsets
// Grid is 10x10, we'll map it to a small area (e.g., 100m x 100m)
const GRID_TO_MAP_OFFSET = 0.0009 // ~100 meters in degrees

function MapBounds({
  events,
  userLocation,
}: {
  events: Array<{ lat: number; lng: number }>
  userLocation: [number, number]
}) {
  const MapBoundsInner = dynamic(
    () =>
      import("react-leaflet").then((mod) => {
        const { useMap } = mod
        return function Inner({
          events: evts,
          userLocation: loc,
        }: {
          events: Array<{ lat: number; lng: number }>
          userLocation: [number, number]
        }) {
          const map = useMap()
          const hasFittedRef = useRef(false)

          useEffect(() => {
            if (evts.length === 0) {
              hasFittedRef.current = false
              return
            }
            // Only fit bounds once when danger first appears, not on every grid update
            if (hasFittedRef.current) return
            hasFittedRef.current = true

            import("leaflet").then((L) => {
              const points: [number, number][] = [
                loc,
                ...evts.map((e) => [e.lat, e.lng] as [number, number]),
              ]
              const bounds = L.default.latLngBounds(points)
              map.fitBounds(bounds, {
                padding: [60, 60],
                maxZoom: 18,
              })
            })
          }, [evts.length, loc, map])

          return null
        }
      }),
    { ssr: false }
  )

  return <MapBoundsInner events={events} userLocation={userLocation} />
}

// Component to handle map initialization after it's created
function MapInitializer() {
  const MapInitializerInner = dynamic(
    () =>
      import("react-leaflet").then((mod) => {
        const { useMap } = mod
        return function Inner() {
          const map = useMap()
          if (!map) return null

          useEffect(() => {
            const container = map.getContainer?.()
            if (!container) return
            const t = setTimeout(() => {
              try {
                map.invalidateSize()
                console.log("[EventMap] Map initialized and size invalidated")
              } catch (err) {
                console.warn("[EventMap] Map invalidateSize skipped", err)
              }
            }, 150)
            return () => clearTimeout(t)
          }, [map])

          return null
        }
      }),
    { ssr: false }
  )

  return <MapInitializerInner />
}

export function EventMap({ grid = [], isMonitoring = false }: EventMapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  )
  const [address, setAddress] = useState<string>("Waiting for location permission...")
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const positionReadingsRef = useRef<Array<{ lat: number; lng: number; accuracy: number; timestamp: number }>>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Helper function for reverse geocoding
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    console.log("[EventMap] 📍 Requesting reverse geocode for coordinates:", { lat, lng })
    
    fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
      .then((res) => {
        console.log("[EventMap] Reverse geocode API response status:", {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok
        })
        return res.json()
      })
      .then((data) => {
        console.log("[EventMap] Reverse geocode API response data:", {
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
          
          console.log("[EventMap] ✅ Address resolved successfully:", {
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
          console.warn("[EventMap] ⚠️ Reverse geocode returned no address:", {
            success: data.success,
            error: data.error,
            data: data
          })
          setAddress(`Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        }
      })
      .catch((err) => {
        console.error("[EventMap] ❌ Reverse geocode fetch error:", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        })
        setAddress(`Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      })
  }, [])

  // Helper function for IP geolocation fallback
  const fallbackToIPGeolocation = useCallback(async () => {
    try {
      const response = await fetch('/api/geolocation')
      const data = await response.json()
      
      if (data.success && data.lat && data.lng) {
        console.log("[EventMap] IP geolocation success:", {
          lat: data.lat,
          lng: data.lng,
          accuracy: `${data.accuracy}m`,
          source: data.source,
          city: data.city
        })
        
        setUserLocation([data.lat, data.lng])
        setLocationAccuracy(data.accuracy)
        reverseGeocode(data.lat, data.lng)
        setIsRequestingLocation(false)
      } else {
        setLocationError("IP-based location failed.")
        setIsRequestingLocation(false)
      }
    } catch (error) {
      console.error("[EventMap] IP geolocation error:", error)
      setLocationError("Unable to determine location.")
      setIsRequestingLocation(false)
    }
  }, [reverseGeocode])

  // Request location with improved accuracy using watchPosition
  const requestLocation = useCallback(async () => {
    if (!isClient) return

    setIsRequestingLocation(true)
    setLocationError(null)

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    
    // Reset position readings
    positionReadingsRef.current = []

    // Method 1: Try browser geolocation with high accuracy using watchPosition
    if (navigator.geolocation) {
      console.log("[EventMap] Requesting high-accuracy browser geolocation...")
      
      // Use watchPosition for continuous updates (better accuracy over time)
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const accuracy = position.coords.accuracy
          
          console.log("[EventMap] Geolocation update:", { 
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
          
          // Keep only last 10 readings
          if (positionReadingsRef.current.length > 10) {
            positionReadingsRef.current.shift()
          }
          
          // Strategy: Wait for high accuracy OR average multiple readings
          // Accept position if accuracy < 50m (good GPS)
          // OR if we have 3+ readings and average them (improves accuracy)
          if (accuracy < 50) {
            console.log("[EventMap] ✅ High accuracy achieved:", { accuracy: `${accuracy.toFixed(0)}m` })
            
            // Clear watch and use this position
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current)
              watchIdRef.current = null
            }
            
            setUserLocation([lat, lng])
            setLocationAccuracy(accuracy)
            setIsRequestingLocation(false)
            reverseGeocode(lat, lng)
          } else if (positionReadingsRef.current.length >= 3) {
            // Average the last 3 readings for better accuracy
            const recentReadings = positionReadingsRef.current.slice(-3)
            const avgLat = recentReadings.reduce((sum, p) => sum + p.lat, 0) / recentReadings.length
            const avgLng = recentReadings.reduce((sum, p) => sum + p.lng, 0) / recentReadings.length
            const avgAccuracy = recentReadings.reduce((sum, p) => sum + p.accuracy, 0) / recentReadings.length
            
            console.log("[EventMap] 📊 Averaging readings:", {
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
              setIsRequestingLocation(false)
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
          console.warn("[EventMap] Browser geolocation error:", error)
          
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
            console.log("[EventMap] Using best reading from collected positions:", {
              lat: bestReading.lat,
              lng: bestReading.lng,
              accuracy: `${bestReading.accuracy.toFixed(0)}m`
            })
            setUserLocation([bestReading.lat, bestReading.lng])
            setLocationAccuracy(bestReading.accuracy)
            setIsRequestingLocation(false)
            reverseGeocode(bestReading.lat, bestReading.lng)
          } else {
            // Fallback to IP geolocation
            let errorMessage = "Unable to get your location"
            if (error && typeof error.code !== 'undefined') {
              switch (error.code) {
                case error.PERMISSION_DENIED || 1:
                  errorMessage = "Location permission denied. Falling back to IP-based location (less accurate)."
                  break
                case error.POSITION_UNAVAILABLE || 2:
                  errorMessage = "Location information unavailable. Falling back to IP-based location."
                  break
                case error.TIMEOUT || 3:
                  errorMessage = "Location request timed out. Falling back to IP-based location."
                  break
                default:
                  errorMessage = `Location error: ${error.message || 'Unknown error'}. Falling back to IP-based location.`
              }
            }
            setLocationError(errorMessage)
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
          console.log("[EventMap] ⏱️ Geolocation timeout - using best reading collected")
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
          
          if (positionReadingsRef.current.length > 0) {
            const bestReading = positionReadingsRef.current.reduce((best, current) => 
              current.accuracy < best.accuracy ? current : best
            )
            setUserLocation([bestReading.lat, bestReading.lng])
            setLocationAccuracy(bestReading.accuracy)
            setIsRequestingLocation(false)
            reverseGeocode(bestReading.lat, bestReading.lng)
          } else {
            fallbackToIPGeolocation()
          }
        }
      }, 30000)
    } else {
      // No geolocation support - use IP only
      console.log("[EventMap] Browser geolocation not supported, using IP-based...")
      fallbackToIPGeolocation()
    }
  }, [isClient, reverseGeocode, fallbackToIPGeolocation, userLocation, locationAccuracy])
  
  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  // Request location when monitoring starts (only if user hasn't granted permission yet)
  useEffect(() => {
    if (!isClient) return
    
    // Only auto-request if monitoring starts and we don't have a location yet
    // This allows the user to manually click the button first
    if (isMonitoring && !userLocation && !isRequestingLocation) {
      // Small delay to ensure it's triggered by user action (monitoring button click)
      setTimeout(() => {
        requestLocation()
      }, 100)
    }
  }, [isClient, isMonitoring, userLocation, isRequestingLocation, requestLocation])

  // Convert grid to map events
  const events = useMemo(() => {
    if (!userLocation) return []

    const [centerLat, centerLng] = userLocation
    const eventList: Array<{
      lat: number
      lng: number
      level: string
      row: number
      col: number
    }> = []

    // Find all DANGER and WARNING cells in the grid
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < (grid[row]?.length || 0); col++) {
        const level = grid[row]?.[col]
        if (level === "DANGER" || level === "WARNING") {
          // Convert grid coordinates (0-9) to map offsets
          // Center the grid around the user location
          const offsetLat = (row - 4.5) * GRID_TO_MAP_OFFSET
          const offsetLng = (col - 4.5) * GRID_TO_MAP_OFFSET

          eventList.push({
            lat: centerLat + offsetLat,
            lng: centerLng + offsetLng,
            level,
            row,
            col,
          })
        }
      }
    }

    return eventList
  }, [grid, userLocation])

  // Get the most critical event for address display
  const primaryEvent = useMemo(() => {
    const dangerEvents = events.filter((e) => e.level === "DANGER")
    if (dangerEvents.length > 0) return dangerEvents[0]
    return events[0] || null
  }, [events])

  // Update address when primary event changes
  useEffect(() => {
    if (!isClient) return

    if (primaryEvent && userLocation) {
      const { lat, lng } = primaryEvent
      fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
        .then((res) => res.json())
        .then((data) => {
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
            setAddress(
              fullAddress || `Event Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`
            )
          } else {
            setAddress(`Event Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`)
          }
        })
        .catch((err) => {
          console.error("[EventMap] Reverse geocode error for event:", err)
          setAddress(`Event Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`)
        })
    } else if (userLocation && events.length === 0) {
      // No events, show user location
      const [lat, lng] = userLocation
      fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
        .then((res) => res.json())
        .then((data) => {
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
            setAddress(fullAddress || "Current Location")
          } else {
            setAddress("Current Location")
          }
        })
        .catch(() => setAddress("Current Location"))
    }
  }, [primaryEvent, userLocation, events, isClient])

  // Set container ready after a short delay once we have location
  useEffect(() => {
    if (isClient && userLocation) {
      // Simple delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setContainerReady(true)
        console.log("[EventMap] Container ready")
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setContainerReady(false)
    }
  }, [isClient, userLocation])

  // Set map loaded after container is ready
  useEffect(() => {
    if (userLocation && isClient && containerReady) {
      // Small delay to ensure container has rendered
      const timer = setTimeout(() => {
        setMapLoaded(true)
        console.log("[EventMap] Map loaded")
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setMapLoaded(false)
    }
  }, [userLocation, isClient, containerReady])

  if (!isClient) {
    return (
      <div className="flex-1 min-h-[350px] md:min-h-0 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading map...</p>
      </div>
    )
  }

  // Show location request UI if no location yet
  if (!userLocation) {
    return (
      <div className="flex-1 min-h-[350px] md:min-h-0 rounded-lg border border-white/10 bg-white/5 flex flex-col items-center justify-center p-6">
        {isRequestingLocation ? (
          <div className="text-center">
            <p className="text-white mb-2 text-base font-medium">
              Requesting location permission...
            </p>
            <p className="text-sm text-white/50 mb-4">
              A browser popup should appear asking for location access.
            </p>
            <p className="text-xs text-white/30">
              If no popup appears, check your browser&apos;s address bar for a location icon.
            </p>
          </div>
        ) : locationError ? (
          <div className="text-center max-w-sm">
            <p className="text-red-400 mb-2 text-base font-semibold">
              Location Access Required
            </p>
            <p className="text-sm text-white/50 mb-4">{locationError}</p>
            <div className="space-y-2">
              <button
                onClick={requestLocation}
                className="w-full px-6 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/30 rounded-sm transition-colors"
              >
                Allow Location Access
              </button>
              <button
                onClick={requestLocation}
                className="w-full px-6 py-2 text-xs text-white/40 border border-white/10 rounded-sm hover:bg-white/5 transition-colors"
              >
                Try IP-Based Location (Less Accurate)
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-sm">
            <p className="text-white mb-2 text-base font-medium">
              Location Access Required
            </p>
            <p className="text-sm text-white/50 mb-4">
              Click below to allow location access and show events on the map.
            </p>
            <button
              onClick={requestLocation}
              className="w-full px-6 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/30 rounded-sm transition-colors"
            >
              Allow Location Access
            </button>
          </div>
        )}
      </div>
    )
  }

  const mapHeight = "clamp(280px, 45vh, 560px)"

  return (
    <div className="flex-1 min-h-[350px] md:min-h-0 rounded-lg border border-white/10 bg-white/5 flex flex-col overflow-hidden">
        {/* Map container - explicit height for Leaflet */}
        <div
          ref={containerRef}
          style={{
            height: mapHeight,
            width: "100%",
            position: "relative",
            flexShrink: 0,
          }}
          id="map-container"
        >
          {mapLoaded && userLocation && containerReady ? (
            <MapContainer
              center={userLocation}
              zoom={DEFAULT_ZOOM}
              style={{
                height: mapHeight,
                width: "100%",
              }}
              scrollWheelZoom={true}
              className="leaflet-container-custom"
              key={`map-${userLocation[0]}-${userLocation[1]}`}
            >
              <MapInitializer />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{
                  loading: () => {
                    console.log("[EventMap] Tiles loading...")
                  },
                  load: () => {
                    console.log("[EventMap] Tiles loaded successfully")
                  },
                  tileerror: (error: any) => {
                    console.error("[EventMap] Tile loading error:", error)
                  }
                }}
              />

              {events.length > 0 && <MapBounds events={events} userLocation={userLocation} />}

              {/* User location marker */}
              <Marker position={userLocation}>
                <Popup>
                  <div>
                    <strong>Your Predicted Location</strong>
                    <br />
                    {address}
                    {locationAccuracy !== null && (
                      <>
                        <br />
                        <span className="text-xs text-gray-500">
                          Accuracy: {locationAccuracy.toFixed(0)}m
                        </span>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>

              {/* Event markers */}
              {events.map((event, index) => (
                <Marker
                  key={`${event.row}-${event.col}-${index}`}
                  position={[event.lat, event.lng]}
                >
                  <Popup>
                    <div>
                      <strong
                        style={{
                          color:
                            event.level === "DANGER" ? "#dc2626" : "#f59e0b",
                        }}
                      >
                        {event.level}
                      </strong>
                      <br />
                      Grid: ({event.row}, {event.col})
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center" style={{ height: mapHeight }}>
              <p className="text-white/40 text-sm">Initializing map...</p>
            </div>
          )}
        </div>

        {/* Address and location info */}
        <div className="p-3 sm:p-4 border-t border-white/10 space-y-2 flex-1">
          <div>
            <label className="text-xs font-medium text-white/40 mb-1 block uppercase tracking-widest">
              {events.length > 0 ? "Event Location" : "Predicted Location"}
            </label>
            <input
              type="text"
              readOnly
              value={events.length > 0 ? address : address || "Getting location..."}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white/80 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
              style={{ cursor: "default" }}
            />
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            {locationAccuracy !== null && (
              <div className="text-white/40">
                <span className="font-medium">Accuracy: </span>
                {locationAccuracy < 50 ? (
                  <span className="text-emerald-400 font-semibold">Excellent ({locationAccuracy.toFixed(0)}m)</span>
                ) : locationAccuracy < 100 ? (
                  <span className="text-emerald-400">Good ({locationAccuracy.toFixed(0)}m)</span>
                ) : locationAccuracy < 500 ? (
                  <span className="text-amber-400">Fair ({locationAccuracy.toFixed(0)}m)</span>
                ) : (
                  <span className="text-red-400">Poor ({locationAccuracy.toFixed(0)}m)</span>
                )}
              </div>
            )}

            {userLocation && (
              <div className="text-white/30">
                <span className="font-medium">Coords: </span>
                <span className="font-mono">{userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}</span>
              </div>
            )}
          </div>

          {locationAccuracy !== null && locationAccuracy > 100 && (
            <div className="text-xs text-amber-400/70 bg-amber-400/5 border border-amber-400/20 rounded px-2 py-1">
              Move to an area with better GPS signal for improved accuracy.
            </div>
          )}
        </div>
    </div>
  )
}
