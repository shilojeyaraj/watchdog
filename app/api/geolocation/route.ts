import { NextRequest, NextResponse } from 'next/server';

/**
 * IP-based geolocation API route
 * Falls back to IP geolocation when browser geolocation is unavailable
 * Uses free IP geolocation services
 */
export async function GET(request: NextRequest) {
  try {
    // Get client IP from request headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = forwarded?.split(',')[0] || realIp || request.ip || '';

    console.log('[Geolocation API] Client IP:', clientIp);

    // Try multiple free IP geolocation services for redundancy
    const services = [
      `https://ipapi.co/${clientIp}/json/`,
      `http://ip-api.com/json/${clientIp}?fields=status,message,country,regionName,city,lat,lon,query`,
    ];

    for (const serviceUrl of services) {
      try {
        const response = await fetch(serviceUrl, {
          headers: {
            'User-Agent': 'Watchdog-App/1.0',
          },
        });

        if (!response.ok) continue;

        const data = await response.json();

        // ipapi.co format
        if (data.latitude && data.longitude) {
          return NextResponse.json({
            success: true,
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            accuracy: 1000, // IP geolocation is typically accurate to ~1km
            source: 'ipapi.co',
            city: data.city,
            region: data.region,
            country: data.country_name,
          });
        }

        // ip-api.com format
        if (data.lat && data.lon && data.status === 'success') {
          return NextResponse.json({
            success: true,
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lon),
            accuracy: 1000,
            source: 'ip-api.com',
            city: data.city,
            region: data.regionName,
            country: data.country,
          });
        }
      } catch (error) {
        console.warn(`[Geolocation API] Service ${serviceUrl} failed:`, error);
        continue;
      }
    }

    return NextResponse.json(
      { success: false, error: 'Unable to determine location from IP' },
      { status: 503 }
    );
  } catch (error) {
    console.error('[Geolocation API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Geolocation service error' },
      { status: 500 }
    );
  }
}
