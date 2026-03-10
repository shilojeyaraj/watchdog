"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@clerk/nextjs"
import { WarningWidget } from "@/components/dashboard/WarningWidget"
import { AISummary } from "@/components/dashboard/SituationSummary"
import { VideoFeed } from "@/components/dashboard/VideoFeed"
import { EventMap } from "@/components/dashboard/EventMap"
import { useOvershootVision } from "@/app/overshoot"

export default function DashboardPage() {
  // Get the current user's Clerk ID for SMS alerts
  const { userId: clerkId } = useAuth()
  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameIntervalRef = useRef<number | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  // Pass clerkId to the overshoot vision hook for user-specific SMS alerts
  const {
    sections,
    overallDangerLevel,
    dangerSince,
    isMonitoring,
    setIsMonitoring,
    setStream,
  } = useOvershootVision({ clerkId })

  // Pass stream to Overshoot when VideoFeed provides it
  useEffect(() => {
    if (remoteStream) {
      setStream(remoteStream)
    } else {
      setStream(null)
    }
  }, [remoteStream, setStream])

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // Handle camera streaming when monitoring starts/stops
  useEffect(() => {
    if (!isMonitoring) {
      // Stop streaming
      if (frameIntervalRef.current !== null) {
        cancelAnimationFrame(frameIntervalRef.current)
        frameIntervalRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setRemoteStream(null)
      return
    }

    // Start camera streaming
    const startCameraStreaming = async () => {
      console.log('[DASHBOARD] Starting camera streaming...')
      
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error("[DASHBOARD] Camera not available - getUserMedia not supported")
        return
      }

      try {
        console.log('[DASHBOARD] Requesting camera access...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        })
        console.log('[DASHBOARD] Camera access granted', { 
          tracks: stream.getTracks().map(t => ({ kind: t.kind, label: t.label }))
        })

        streamRef.current = stream
        setRemoteStream(stream)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          console.log('[DASHBOARD] Stream attached to video element')
          
          // Play the video to ensure it starts
          videoRef.current.play().catch((err) => {
            console.error('[DASHBOARD] Error playing video:', err)
          })
          
          // Wait for video to be ready before capturing frames
          videoRef.current.onloadedmetadata = () => {
            console.log('[DASHBOARD] Video metadata loaded', {
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight
            })
          }
        }

        // Setup canvas for frame capture
        const canvas = canvasRef.current
        if (!canvas) {
          console.error('[DASHBOARD] Canvas ref is null')
          return
        }

        const video = videoRef.current
        if (!video) {
          console.error('[DASHBOARD] Video ref is null')
          return
        }

        // Wait for video to have dimensions
        const waitForVideo = () => {
          return new Promise<void>((resolve) => {
            if (video.videoWidth && video.videoHeight) {
              resolve()
              return
            }
            video.onloadedmetadata = () => resolve()
            // Also try playing the video
            video.play().catch(() => {})
          })
        }
        
        await waitForVideo()
        
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        console.log('[DASHBOARD] Canvas dimensions set', { 
          width: canvas.width, 
          height: canvas.height 
        })

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          console.error('[DASHBOARD] Could not get canvas 2d context')
          return
        }

        let frameCount = 0
        
        // Capture and send frames via API
        const sendFrame = async () => {
          if (!video.videoWidth || !video.videoHeight) {
            console.log('[DASHBOARD] Waiting for video dimensions...')
            frameIntervalRef.current = requestAnimationFrame(sendFrame)
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = canvas.toDataURL("image/jpeg", 0.7)
          frameCount++

          try {
            const response = await fetch("/api/camera/upload", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                imageData,
                timestamp: Date.now(),
                cameraId: "default",
              }),
            })
            
            // Log every 30th frame
            if (frameCount % 30 === 1) {
              console.log(`[DASHBOARD] Frame #${frameCount} uploaded`, {
                status: response.status,
                imageDataLength: imageData.length
              })
            }
          } catch (error) {
            console.error("[DASHBOARD] Error sending frame:", error)
          }

          frameIntervalRef.current = requestAnimationFrame(sendFrame)
        }

        console.log('[DASHBOARD] Starting frame capture loop')
        sendFrame()
      } catch (error) {
        console.error("[DASHBOARD] Error accessing camera:", error)
      }
    }

    startCameraStreaming()
  }, [isMonitoring])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current !== null) {
        cancelAnimationFrame(frameIntervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Show loading while checking auth (AFTER all hooks)
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-sm tracking-widest uppercase">Loading...</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return null // Will redirect
  }

  const username = user?.firstName || user?.username || "User"

  // Map medium or high level dangers directly to the 10x10 grid coordinates
  const combinedPersonGrid = Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 10 }, (_, col) => {
      // Check for DANGER level first (highest priority)
      if (sections.closest?.grid?.[row]?.[col] && sections.closest.level === "DANGER") {
        return "DANGER"
      }
      if (sections.middle?.grid?.[row]?.[col] && sections.middle.level === "DANGER") {
        return "DANGER"
      }
      if (sections.farthest?.grid?.[row]?.[col] && sections.farthest.level === "DANGER") {
        return "DANGER"
      }

      // Check for WARNING level (medium priority)
      if (sections.closest?.grid?.[row]?.[col] && sections.closest.level === "WARNING") {
        return "WARNING"
      }
      if (sections.middle?.grid?.[row]?.[col] && sections.middle.level === "WARNING") {
        return "WARNING"
      }
      if (sections.farthest?.grid?.[row]?.[col] && sections.farthest.level === "WARNING") {
        return "WARNING"
      }

      // Check for SAFE level (lowest priority, only if person detected)
      if (sections.closest?.grid?.[row]?.[col] && sections.closest.level === "SAFE") {
        return "SAFE"
      }
      if (sections.middle?.grid?.[row]?.[col] && sections.middle.level === "SAFE") {
        return "SAFE"
      }
      if (sections.farthest?.grid?.[row]?.[col] && sections.farthest.level === "SAFE") {
        return "SAFE"
      }

      return null // No person detected
    })
  )

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex flex-col flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-light text-white mb-4 sm:mb-6 shrink-0">
          Welcome {username}.
        </h1>

        {/* Status row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4 shrink-0">
          <WarningWidget level={overallDangerLevel} since={dangerSince} />
          <AISummary
            title="AI Summary of Ongoing Situation"
            sections={sections}
          />
        </div>

        {/* Main row – fills remaining height */}
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4 flex-1">
          <div className="flex flex-col flex-1 gap-3 min-h-0">
            <div className="relative rounded-lg overflow-hidden flex-1 min-h-[280px] md:min-h-0">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-auto hidden"
              />
              <canvas ref={canvasRef} className="hidden" />
              <VideoFeed
                active={isMonitoring}
                onStreamReady={setRemoteStream}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsMonitoring((value) => !value)}
              className="self-start px-6 py-2.5 text-xs sm:text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/30 rounded-sm backdrop-blur-sm transition-colors shrink-0"
            >
              {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
            </button>
          </div>
          <EventMap grid={combinedPersonGrid} isMonitoring={isMonitoring} />
        </div>
      </div>
    </div>
  )
}