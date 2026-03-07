import { NextRequest, NextResponse } from 'next/server';

/**
 * Reverse Geocoding API Route
 * Converts coordinates (lat/lng) to addresses using multiple services
 * Priority: Mapbox > Nominatim (fallback)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing lat or lng parameters' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid lat or lng values' },
        { status: 400 }
      );
    }

    console.log('[Reverse Geocode API] Requesting address for:', { lat: latitude, lng: longitude });

    // Method 1: Try Mapbox Geocoding API (most accurate)
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    console.log('[Reverse Geocode API] Mapbox token check:', {
      hasToken: !!mapboxToken,
      tokenPrefix: mapboxToken ? mapboxToken.substring(0, 10) + '...' : 'none',
      tokenLength: mapboxToken?.length || 0
    });
    
    if (mapboxToken) {
      try {
        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=address&limit=1`;
        
        console.log('[Reverse Geocode API] Calling Mapbox API...', {
          url: mapboxUrl.replace(mapboxToken, 'TOKEN_HIDDEN'),
          coordinates: `${longitude},${latitude}`,
          timestamp: new Date().toISOString()
        });
        
        const mapboxResponse = await fetch(mapboxUrl, {
          headers: {
            'User-Agent': 'Watchdog-App/1.0',
          },
        });

        console.log('[Reverse Geocode API] Mapbox response status:', {
          status: mapboxResponse.status,
          statusText: mapboxResponse.statusText,
          ok: mapboxResponse.ok,
          headers: Object.fromEntries(mapboxResponse.headers.entries())
        });

        if (mapboxResponse.ok) {
          const mapboxData = await mapboxResponse.json();
          
          console.log('[Reverse Geocode API] Mapbox raw response:', {
            hasFeatures: !!mapboxData.features,
            featuresCount: mapboxData.features?.length || 0,
            firstFeature: mapboxData.features?.[0] ? {
              id: mapboxData.features[0].id,
              place_name: mapboxData.features[0].place_name,
              text: mapboxData.features[0].text,
              contextCount: mapboxData.features[0].context?.length || 0
            } : null
          });
          
          if (mapboxData.features && mapboxData.features.length > 0) {
            const feature = mapboxData.features[0];
            const context = feature.context || [];
            
            // Extract address components from Mapbox response
            // Mapbox context array contains objects with id like "address.123456" or "place.123456"
            const addressComponents: Record<string, string> = {};
            context.forEach((item: any) => {
              const id = item.id || '';
              if (id.startsWith('address.')) {
                addressComponents.street_number = item.text || '';
              } else if (id.startsWith('street.')) {
                addressComponents.street_name = item.text || '';
              } else if (id.startsWith('place.')) {
                // Place can be city, town, village, etc.
                if (!addressComponents.city) {
                  addressComponents.city = item.text || '';
                }
              } else if (id.startsWith('district.')) {
                // District might be a neighborhood or area
                if (!addressComponents.city) {
                  addressComponents.city = item.text || '';
                }
              } else if (id.startsWith('region.')) {
                addressComponents.state = item.text || '';
              } else if (id.startsWith('postcode.')) {
                addressComponents.postcode = item.text || '';
              } else if (id.startsWith('country.')) {
                addressComponents.country = item.text || '';
              }
            });

            // Mapbox provides the full address in feature.place_name
            // Format: "295 Lester Street, Waterloo, ON N2L 0B9, Canada"
            const fullAddress = feature.place_name || feature.text || '';
            
            // Parse street address from place_name (first part before first comma)
            const placeNameParts = fullAddress.split(',');
            const streetAddress = placeNameParts[0]?.trim() || '';
            
            // Try to extract street number and name from street address
            const streetMatch = streetAddress.match(/^(\d+)\s+(.+)$/);
            const streetNumber = streetMatch ? streetMatch[1] : '';
            const streetName = streetMatch ? streetMatch[2] : streetAddress;
            
            const parsedAddress = {
              full: fullAddress,
              street: streetAddress,
              streetNumber: streetNumber || addressComponents.street_number || '',
              streetName: streetName || addressComponents.street_name || '',
              city: addressComponents.city || '',
              state: addressComponents.state || '',
              postalCode: addressComponents.postcode || '',
              country: addressComponents.country || '',
            };

            console.log('[Reverse Geocode API] ✅ Mapbox SUCCESS - Parsed address:', {
              full: parsedAddress.full,
              street: parsedAddress.street,
              streetNumber: parsedAddress.streetNumber,
              streetName: parsedAddress.streetName,
              city: parsedAddress.city,
              state: parsedAddress.state,
              postalCode: parsedAddress.postalCode,
              country: parsedAddress.country,
              source: 'mapbox',
              accuracy: 'address-level'
            });

            return NextResponse.json({
              success: true,
              source: 'mapbox',
              address: parsedAddress,
              coordinates: {
                lat: latitude,
                lng: longitude,
              },
              accuracy: 'address-level', // Mapbox provides building-level accuracy
            });
          } else {
            console.warn('[Reverse Geocode API] ⚠️ Mapbox returned no features:', {
              responseData: JSON.stringify(mapboxData).substring(0, 200)
            });
          }
        } else {
          const errorText = await mapboxResponse.text().catch(() => 'Unable to read error');
          console.error('[Reverse Geocode API] ❌ Mapbox API error:', {
            status: mapboxResponse.status,
            statusText: mapboxResponse.statusText,
            errorBody: errorText.substring(0, 200)
          });
        }
      } catch (mapboxError) {
        console.error('[Reverse Geocode API] ❌ Mapbox exception:', {
          error: mapboxError instanceof Error ? mapboxError.message : String(mapboxError),
          stack: mapboxError instanceof Error ? mapboxError.stack : undefined
        });
        // Continue to fallback
      }
    } else {
      console.log('[Reverse Geocode API] ⚠️ Mapbox token not configured, skipping Mapbox and using Nominatim fallback');
    }

    // Method 2: Fallback to Nominatim (OpenStreetMap) - free but less accurate
    try {
      console.log('[Reverse Geocode API] 🔄 Falling back to Nominatim (OpenStreetMap)...');
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`;
      
      console.log('[Reverse Geocode API] Calling Nominatim API...', {
        url: nominatimUrl,
        coordinates: `${latitude},${longitude}`,
        timestamp: new Date().toISOString()
      });
      
      const nominatimResponse = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Watchdog-App/1.0', // Required by Nominatim
          'Accept-Language': 'en',
        },
      });

      console.log('[Reverse Geocode API] Nominatim response status:', {
        status: nominatimResponse.status,
        statusText: nominatimResponse.statusText,
        ok: nominatimResponse.ok
      });

      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        
        console.log('[Reverse Geocode API] Nominatim raw response:', {
          hasAddress: !!nominatimData.address,
          addressKeys: nominatimData.address ? Object.keys(nominatimData.address) : [],
          displayName: nominatimData.display_name
        });
        
        if (nominatimData.address) {
          const addr = nominatimData.address;
          const fullAddress = [
            addr.house_number,
            addr.road,
            addr.city || addr.town || addr.village,
            addr.state || addr.province,
            addr.postcode,
          ]
            .filter(Boolean)
            .join(', ');

          const parsedAddress = {
            full: fullAddress,
            street: [addr.house_number, addr.road].filter(Boolean).join(' '),
            streetNumber: addr.house_number || '',
            streetName: addr.road || '',
            city: addr.city || addr.town || addr.village || '',
            state: addr.state || addr.province || '',
            postalCode: addr.postcode || '',
            country: addr.country || '',
          };

          console.log('[Reverse Geocode API] ✅ Nominatim SUCCESS - Parsed address:', {
            ...parsedAddress,
            source: 'nominatim',
            accuracy: 'street-level'
          });

          return NextResponse.json({
            success: true,
            source: 'nominatim',
            address: parsedAddress,
            coordinates: {
              lat: latitude,
              lng: longitude,
            },
            accuracy: 'street-level', // Nominatim is less precise
          });
        } else {
          console.warn('[Reverse Geocode API] ⚠️ Nominatim returned no address data');
        }
      } else {
        const errorText = await nominatimResponse.text().catch(() => 'Unable to read error');
        console.error('[Reverse Geocode API] ❌ Nominatim API error:', {
          status: nominatimResponse.status,
          statusText: nominatimResponse.statusText,
          errorBody: errorText.substring(0, 200)
        });
      }
    } catch (nominatimError) {
      console.error('[Reverse Geocode API] ❌ Nominatim exception:', {
        error: nominatimError instanceof Error ? nominatimError.message : String(nominatimError),
        stack: nominatimError instanceof Error ? nominatimError.stack : undefined
      });
    }

    // All methods failed
    console.error('[Reverse Geocode API] ❌ ALL METHODS FAILED - Unable to reverse geocode:', {
      coordinates: { lat: latitude, lng: longitude },
      mapboxAttempted: !!mapboxToken,
      nominatimAttempted: true
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to reverse geocode coordinates',
        coordinates: { lat: latitude, lng: longitude },
      },
      { status: 503 }
    );
  } catch (error) {
    console.error('[Reverse Geocode API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Reverse geocoding service error' },
      { status: 500 }
    );
  }
}
