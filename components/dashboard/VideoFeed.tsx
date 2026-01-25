"use client"

import { useEffect, useRef, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"

// Debug logging helper
const DEBUG_VIDEO_FEED = true
const logVideoFeed = (message: string, data?: unknown) => {
  if (DEBUG_VIDEO_FEED) {
    const timestamp = new Date().toISOString().split('T')[1]
    if (data !== undefined) {
      console.log(`[VIDEO FEED ${timestamp}] ${message}`, data)
    } else {
      console.log(`[VIDEO FEED ${timestamp}] ${message}`)
    }
  }
}

interface VideoFeedProps {
  active: boolean
  onStreamReady?: (stream: MediaStream) => void
}

export function VideoFeed({ active, onStreamReady }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pollIntervalRef = useRef<number | null>(null)
  const lastFrameTimestampRef = useRef<number>(0)
  const streamCreatedRef = useRef<boolean>(false)
  const canvasInitializedRef = useRef<boolean>(false)
  const frameCountRef = useRef<number>(0)
  const pollCountRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  
  // Log component mount/unmount
  useEffect(() => {
    logVideoFeed('Component MOUNTED', { active })
    return () => {
      logVideoFeed('Component UNMOUNTED')
    }
  }, [])

  useEffect(() => {
    logVideoFeed('Active state changed', { active })
    
        if (!active) {
          logVideoFeed('Deactivating - cleaning up resources')
          // Abort any pending fetch requests
          if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
            logVideoFeed('Aborted pending fetch requests')
          }
          if (pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
            logVideoFeed('Cleared poll interval')
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
            logVideoFeed('Stopped and cleared stream')
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null
          }
          canvasInitializedRef.current = false
          streamCreatedRef.current = false
          frameCountRef.current = 0
          pollCountRef.current = 0
          setIsConnected(false)
          setHasCamera(false)
          logVideoFeed('Cleanup complete')
          return
        }

        let cancelled = false
        logVideoFeed('Activating - starting frame polling')
        
        // Create AbortController for this polling session
        abortControllerRef.current = new AbortController()

        // Poll for frames from API
        const pollForFrames = async () => {
          if (cancelled) return
          
          pollCountRef.current++
          const pollNum = pollCountRef.current

          try {
            const fetchStart = performance.now()
            const response = await fetch("/api/camera/frame?cameraId=default", {
              signal: abortControllerRef.current?.signal
            })
            const fetchTime = performance.now() - fetchStart
        
        if (!response.ok) {
          if (pollNum % 30 === 1) {
            logVideoFeed(`Poll #${pollNum}: API error`, {
              status: response.status,
              statusText: response.statusText
            })
          }
          return
        }
        
        const data = await response.json()
        
        // Log every 30th poll to avoid console spam (roughly once per second at 30fps)
        if (pollNum % 30 === 1) {
          logVideoFeed(`Poll #${pollNum}`, {
            status: response.status,
            fetchTime: `${fetchTime.toFixed(1)}ms`,
            hasFrame: !!data.frame,
            frameDataLength: data.frame?.imageData?.length || 0,
            frameTimestamp: data.frame?.timestamp,
            responseKeys: Object.keys(data)
          })
        }

        if (cancelled) return

        if (data.frame && data.frame.imageData) {
          // Log first frame always
          if (frameCountRef.current === 0) {
            logVideoFeed('FIRST FRAME RECEIVED!', {
              hasImageData: !!data.frame.imageData,
              imageDataLength: data.frame.imageData?.length || 0,
              imageDataStart: data.frame.imageData?.substring(0, 30) || 'none',
              timestamp: data.frame.timestamp
            })
          }
          
          // Check if this is a new frame (allow same timestamp to handle rapid updates)
          if (data.frame.timestamp >= lastFrameTimestampRef.current) {
            frameCountRef.current++
            const frameNum = frameCountRef.current
            const timeSinceLastFrame = lastFrameTimestampRef.current > 0 
              ? data.frame.timestamp - lastFrameTimestampRef.current 
              : 0
            lastFrameTimestampRef.current = data.frame.timestamp
            
            // Log every 30th frame or first few frames
            if (frameNum % 30 === 1 || frameNum <= 5) {
              logVideoFeed(`New frame #${frameNum}`, {
                timeSinceLastFrame: `${timeSinceLastFrame}ms`,
                imageDataLength: data.frame.imageData.length,
                imageDataPreview: data.frame.imageData.substring(0, 50) + '...',
                timestamp: data.frame.timestamp
              })
            }

            if (!hasCamera) {
              logVideoFeed('First frame received - camera now active')
              setHasCamera(true)
            }
            setIsConnected(true)

            const video = videoRef.current
            const canvas = canvasRef.current

            if (!video || !canvas) {
              logVideoFeed('ERROR: video or canvas ref is null', { video: !!video, canvas: !!canvas })
              return
            }

            const ctx = canvas.getContext("2d")
            if (!ctx) {
              logVideoFeed('ERROR: Could not get canvas 2d context')
              return
            }

            // Create new image for each frame
            const img = new Image()
            img.crossOrigin = "anonymous"
            const imgLoadStart = performance.now()
            
            // Set up load handler - this runs when image loads
            img.onload = () => {
              if (cancelled) return
              const imgLoadTime = performance.now() - imgLoadStart

              // Initialize canvas dimensions only once on first frame
              if (!canvasInitializedRef.current) {
                const targetWidth = img.width || 1280
                const targetHeight = img.height || 720
                canvas.width = targetWidth
                canvas.height = targetHeight
                canvasInitializedRef.current = true
                
                logVideoFeed('Canvas initialized', {
                  width: targetWidth,
                  height: targetHeight,
                  imgWidth: img.width,
                  imgHeight: img.height
                })
                
                // Ensure canvas is visible and has proper styling
                canvas.style.display = 'block'
                canvas.style.width = '100%'
                canvas.style.height = '100%'
                canvas.style.objectFit = 'cover'
              }
              
              // CRITICAL: Draw the image to canvas on EVERY frame
              // This must happen for every frame that loads, not just the first one
              try {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                if (frameCountRef.current % 30 === 1 || frameCountRef.current <= 3) {
                  logVideoFeed(`Frame #${frameCountRef.current} drawn to canvas`, {
                    imgLoadTime: `${imgLoadTime.toFixed(1)}ms`,
                    canvasSize: `${canvas.width}x${canvas.height}`
                  })
                }
              } catch (drawError) {
                logVideoFeed('ERROR drawing to canvas', drawError)
              }
              
              // Create a MediaStream from canvas for Overshoot SDK (only once, after first draw)
              if (!streamCreatedRef.current && canvas.captureStream && video && canvas.width > 0 && canvas.height > 0) {
                logVideoFeed('Creating MediaStream from canvas for SDK...')
                try {
                  const stream = canvas.captureStream(30) // 30 FPS
                  streamRef.current = stream
                  streamCreatedRef.current = true
                  
                  logVideoFeed('MediaStream created', {
                    tracks: stream.getTracks().map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled }))
                  })
                  
                  // Set the stream on video element for SDK
                  video.srcObject = stream
                  
                  // Try playing video (for SDK, even though it's hidden)
                  video.play().catch((err) => {
                    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                      logVideoFeed('ERROR playing video for SDK', err)
                    }
                  })
                  
                  // Notify parent that stream is ready - this starts the Overshoot SDK
                  logVideoFeed('Calling onStreamReady callback')
                  onStreamReady?.(stream)
                } catch (err) {
                  logVideoFeed('ERROR creating canvas stream for SDK', err)
                }
              }
            }
            
            img.onerror = (err) => {
              logVideoFeed('ERROR loading image frame', err)
            }
            
            // Load the image - this triggers onload when ready
            img.src = data.frame.imageData
          } else {
            // Frame is same or older than last one
            if (pollNum % 30 === 1) {
              logVideoFeed(`Poll #${pollNum}: Skipping duplicate/old frame`, {
                receivedTimestamp: data.frame.timestamp,
                lastTimestamp: lastFrameTimestampRef.current
              })
            }
          }
        } else {
          // No frame available
          if (pollNum % 30 === 1) {
            logVideoFeed(`Poll #${pollNum}: No frame available from API`, {
              responseData: data
            })
          }
          if (hasCamera) {
            logVideoFeed('Lost camera connection - no frames available')
            setHasCamera(false)
          }
        }
      } catch (error) {
        // Ignore aborted errors (happens during Fast Refresh/unmount)
        if (error instanceof Error && error.name === 'AbortError') {
          logVideoFeed('Poll aborted (component unmounting)', { pollNum })
          return
        }
        // Ignore ECONNRESET errors (happens during Fast Refresh)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNRESET') {
          logVideoFeed('Connection reset (Fast Refresh)', { pollNum })
          return
        }
        logVideoFeed('ERROR polling for frames', error)
        if (hasCamera) {
          setHasCamera(false)
        }
      }
    }

    // Start polling every 33ms (~30 FPS)
    logVideoFeed('Starting poll interval (33ms / ~30 FPS)')
    pollIntervalRef.current = window.setInterval(pollForFrames, 33)
    pollForFrames() // Initial poll

        return () => {
          cancelled = true
          // Abort any pending fetch requests
          if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
          }
          if (pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null
          }
        }
  }, [active, onStreamReady, hasCamera])

  return (
    <Card className="h-full min-h-[60vh] sm:min-h-[60vh] flex-1">
      <CardContent className="flex items-center justify-center h-full p-0 relative overflow-hidden">
        <video
          ref={videoRef}
          id="camera"
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover rounded-2xl bg-black"
          style={{ 
            backgroundColor: '#000',
            display: 'none' // Hidden - only used by Overshoot SDK
          }}
        />
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-cover rounded-2xl bg-black"
          width={1280}
          height={720}
          style={{ 
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000',
            zIndex: 1
          }}
        />
        {!hasCamera && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl z-20 pointer-events-none">
            <p className="text-white text-xl font-extrabold">Camera Disabled, Video Feed Paused</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
