import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/mappreview", // Map preview page for testing Leaflet
  "/api/webhooks(.*)",
  "/api/geolocation", // IP-based geolocation API (no auth needed)
  "/api/geocode(.*)", // Reverse geocoding API (no auth needed)
  // Note: /api/users/sync is NOT public - it requires authentication
  // Removing it from public routes so auth() works correctly
  "/api/camera(.*)", // Camera API routes (frame upload/retrieval)
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
