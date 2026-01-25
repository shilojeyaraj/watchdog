/**
 * Frame Streaming Pipeline Test
 * 
 * This script tests the entire frame streaming pipeline:
 * 1. Uploads test frames to /api/camera/upload
 * 2. Retrieves frames from /api/camera/frame
 * 3. Verifies the data integrity
 * 
 * Usage:
 *   node test-frame-streaming.js
 * 
 * Make sure the dev server is running (npm run dev) before running this test.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Create a simple test image (1x1 red pixel as base64 JPEG)
function createTestImageData(index) {
  // This is a minimal valid JPEG base64 string (red pixel)
  // In real testing, you might want to use different images
  const redPixelJpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==';
  
  return `data:image/jpeg;base64,${redPixelJpeg}`;
}

// Stats tracking
const stats = {
  framesSent: 0,
  framesReceived: 0,
  framesMatched: 0,
  errors: [],
  latencies: [],
};

async function uploadFrame(cameraId, timestamp) {
  const imageData = createTestImageData(stats.framesSent);
  
  const start = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/api/camera/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData,
        timestamp,
        cameraId,
      }),
    });
    
    const latency = performance.now() - start;
    const data = await response.json();
    
    if (response.ok && data.success) {
      stats.framesSent++;
      return { success: true, latency, timestamp };
    } else {
      stats.errors.push({ type: 'upload', status: response.status, data });
      return { success: false, error: data };
    }
  } catch (error) {
    stats.errors.push({ type: 'upload', error: error.message });
    return { success: false, error: error.message };
  }
}

async function getFrame(cameraId) {
  const start = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/api/camera/frame?cameraId=${cameraId}`);
    const latency = performance.now() - start;
    const data = await response.json();
    
    stats.latencies.push(latency);
    
    if (response.ok) {
      if (data.frame) {
        stats.framesReceived++;
        return { 
          success: true, 
          latency, 
          frame: data.frame,
          hasImage: !!data.frame.imageData,
          imageLength: data.frame.imageData?.length || 0,
        };
      } else {
        return { success: true, latency, frame: null };
      }
    } else {
      stats.errors.push({ type: 'get', status: response.status, data });
      return { success: false, error: data };
    }
  } catch (error) {
    stats.errors.push({ type: 'get', error: error.message });
    return { success: false, error: error.message };
  }
}

async function runTest() {
  console.log('\n========================================');
  console.log('  Frame Streaming Pipeline Test');
  console.log('========================================\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  // Test 1: Check if API is reachable
  console.log('Test 1: API Connectivity');
  console.log('------------------------');
  try {
    const response = await fetch(`${BASE_URL}/api/camera/frame?cameraId=test`);
    console.log(`  ✓ API reachable (status: ${response.status})`);
  } catch (error) {
    console.log(`  ✗ API not reachable: ${error.message}`);
    console.log('\n  Make sure the dev server is running: npm run dev\n');
    process.exit(1);
  }

  // Test 2: Upload a single frame
  console.log('\nTest 2: Single Frame Upload');
  console.log('---------------------------');
  const timestamp1 = Date.now();
  const upload1 = await uploadFrame('test-camera', timestamp1);
  if (upload1.success) {
    console.log(`  ✓ Frame uploaded successfully`);
    console.log(`    Latency: ${upload1.latency.toFixed(1)}ms`);
    console.log(`    Timestamp: ${timestamp1}`);
  } else {
    console.log(`  ✗ Upload failed: ${JSON.stringify(upload1.error)}`);
  }

  // Test 3: Retrieve the frame
  console.log('\nTest 3: Frame Retrieval');
  console.log('-----------------------');
  const get1 = await getFrame('test-camera');
  if (get1.success && get1.frame) {
    console.log(`  ✓ Frame retrieved successfully`);
    console.log(`    Latency: ${get1.latency.toFixed(1)}ms`);
    console.log(`    Has image data: ${get1.hasImage}`);
    console.log(`    Image data length: ${get1.imageLength} chars`);
    console.log(`    Frame timestamp: ${get1.frame.timestamp}`);
    
    if (get1.frame.timestamp === timestamp1) {
      console.log(`  ✓ Timestamp matches uploaded frame`);
      stats.framesMatched++;
    } else {
      console.log(`  ⚠ Timestamp mismatch! Expected: ${timestamp1}, Got: ${get1.frame.timestamp}`);
    }
  } else if (get1.success && !get1.frame) {
    console.log(`  ✗ No frame returned (frame was not stored or already expired)`);
  } else {
    console.log(`  ✗ Retrieval failed: ${JSON.stringify(get1.error)}`);
  }

  // Test 4: Frame expiry (frames older than 5 seconds should be cleaned up)
  console.log('\nTest 4: Frame Freshness Check');
  console.log('-----------------------------');
  const get2 = await getFrame('test-camera');
  if (get2.success && get2.frame) {
    const age = Date.now() - get2.frame.timestamp;
    console.log(`  Frame age: ${age}ms`);
    if (age < 5000) {
      console.log(`  ✓ Frame is fresh (< 5 seconds old)`);
    } else {
      console.log(`  ⚠ Frame is stale (> 5 seconds old) - may be cleaned up soon`);
    }
  }

  // Test 5: Rapid frame upload/retrieve (simulate streaming)
  console.log('\nTest 5: Streaming Simulation (10 frames)');
  console.log('----------------------------------------');
  const streamResults = [];
  
  for (let i = 0; i < 10; i++) {
    const ts = Date.now();
    const uploadResult = await uploadFrame('stream-test', ts);
    
    // Small delay to simulate frame rate
    await new Promise(r => setTimeout(r, 33)); // ~30fps
    
    const getResult = await getFrame('stream-test');
    
    streamResults.push({
      uploaded: uploadResult.success,
      retrieved: getResult.success && getResult.frame,
      timestampMatch: getResult.frame?.timestamp === ts,
      uploadLatency: uploadResult.latency,
      retrieveLatency: getResult.latency,
    });
    
    if (getResult.frame?.timestamp === ts) {
      stats.framesMatched++;
    }
  }
  
  const uploadedCount = streamResults.filter(r => r.uploaded).length;
  const retrievedCount = streamResults.filter(r => r.retrieved).length;
  const matchedCount = streamResults.filter(r => r.timestampMatch).length;
  const avgUploadLatency = streamResults.reduce((a, r) => a + (r.uploadLatency || 0), 0) / streamResults.length;
  const avgRetrieveLatency = streamResults.reduce((a, r) => a + (r.retrieveLatency || 0), 0) / streamResults.length;
  
  console.log(`  Frames uploaded:  ${uploadedCount}/10`);
  console.log(`  Frames retrieved: ${retrievedCount}/10`);
  console.log(`  Timestamps matched: ${matchedCount}/10`);
  console.log(`  Avg upload latency: ${avgUploadLatency.toFixed(1)}ms`);
  console.log(`  Avg retrieve latency: ${avgRetrieveLatency.toFixed(1)}ms`);
  
  if (matchedCount === 10) {
    console.log(`  ✓ All frames streamed successfully!`);
  } else if (matchedCount > 5) {
    console.log(`  ⚠ Some frames may have been overwritten (expected at high frame rates)`);
  } else {
    console.log(`  ✗ Significant frame loss detected`);
  }

  // Test 6: Different camera IDs
  console.log('\nTest 6: Multiple Camera IDs');
  console.log('---------------------------');
  const cameras = ['cam-1', 'cam-2', 'cam-3'];
  for (const cam of cameras) {
    const ts = Date.now();
    await uploadFrame(cam, ts);
    const result = await getFrame(cam);
    if (result.success && result.frame?.timestamp === ts) {
      console.log(`  ✓ ${cam}: Frame stored and retrieved`);
    } else {
      console.log(`  ✗ ${cam}: Failed`);
    }
  }

  // Test 7: Default camera ID
  console.log('\nTest 7: Default Camera ID');
  console.log('-------------------------');
  const defaultTs = Date.now();
  await uploadFrame('default', defaultTs);
  const defaultResult = await getFrame('default');
  if (defaultResult.success && defaultResult.frame) {
    console.log(`  ✓ Default camera working`);
    console.log(`    This is what VideoFeed polls: /api/camera/frame?cameraId=default`);
  } else {
    console.log(`  ✗ Default camera not working - VideoFeed will not receive frames!`);
  }

  // Summary
  console.log('\n========================================');
  console.log('  Test Summary');
  console.log('========================================');
  console.log(`  Total frames sent: ${stats.framesSent}`);
  console.log(`  Total frames received: ${stats.framesReceived}`);
  console.log(`  Frames matched: ${stats.framesMatched}`);
  console.log(`  Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n  Errors encountered:');
    stats.errors.forEach((e, i) => {
      console.log(`    ${i + 1}. [${e.type}] ${e.error || e.status}`);
    });
  }

  const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
  console.log(`\n  Average retrieval latency: ${avgLatency.toFixed(1)}ms`);
  
  if (stats.errors.length === 0 && stats.framesReceived > 0) {
    console.log('\n  ✅ PASS: Frame streaming pipeline is working!\n');
  } else {
    console.log('\n  ❌ FAIL: Issues detected in frame streaming pipeline\n');
  }

  // Debugging tips
  console.log('========================================');
  console.log('  Debugging Tips');
  console.log('========================================');
  console.log(`
  If VideoFeed is not receiving frames:
  
  1. Check browser console for [VIDEO FEED] logs
     - Look for "Poll #N" messages
     - Check if frames are being received
     
  2. Check server terminal for [CAMERA STORE] logs
     - Verify frames are being stored
     - Check cleanup operations
     
  3. Verify camera page is sending frames
     - Open /camera in a separate browser tab
     - Check for [CAMERA UPLOAD API] logs in server
     
  4. Check cameraId matches
     - Dashboard uses "default" cameraId
     - Camera page should also use "default"
     
  5. Check frame expiry
     - Frames expire after 5 seconds
     - If camera page stops, frames will disappear
  `);
}

// Run the test
runTest().catch(console.error);
