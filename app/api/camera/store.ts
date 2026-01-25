// Shared in-memory store for video frames
// In production, replace this with Redis or similar persistent store
const frameStore = new Map<string, { imageData: string; timestamp: number }>();

export function setFrame(cameraId: string, imageData: string, timestamp: number) {
  console.log(`[CAMERA STORE] setFrame called for cameraId: ${cameraId}`);
  console.log(`[CAMERA STORE] Image data length: ${imageData?.length || 0} chars`);
  console.log(`[CAMERA STORE] Timestamp: ${timestamp} (${new Date(timestamp).toISOString()})`);
  
  frameStore.set(cameraId, { imageData, timestamp });
  console.log(`[CAMERA STORE] Frame stored successfully. Total frames in store: ${frameStore.size}`);
  
  // Clean up old frames (older than 10 seconds - increased to prevent premature cleanup)
  // This gives VideoFeed enough time to poll and retrieve frames
  const now = Date.now();
  let cleanedCount = 0;
  for (const [key, value] of frameStore.entries()) {
    if (now - value.timestamp > 10000) { // Increased from 5000ms to 10000ms (10 seconds)
      frameStore.delete(key);
      cleanedCount++;
      console.log(`[CAMERA STORE] Cleaned up old frame for cameraId: ${key} (age: ${now - value.timestamp}ms)`);
    }
  }
  if (cleanedCount > 0) {
    console.log(`[CAMERA STORE] Cleanup complete. Removed ${cleanedCount} old frame(s). Remaining: ${frameStore.size}`);
  }
}

export function getFrame(cameraId: string): { imageData: string; timestamp: number } | null {
  console.log(`[CAMERA STORE] getFrame called for cameraId: ${cameraId}`);
  const frame = frameStore.get(cameraId) || null;
  if (frame) {
    const age = Date.now() - frame.timestamp;
    console.log(`[CAMERA STORE] Frame found! Age: ${age}ms, Data length: ${frame.imageData?.length || 0} chars`);
  } else {
    console.log(`[CAMERA STORE] No frame found for cameraId: ${cameraId}`);
    console.log(`[CAMERA STORE] Available cameraIds: [${Array.from(frameStore.keys()).join(', ')}]`);
  }
  return frame;
}
