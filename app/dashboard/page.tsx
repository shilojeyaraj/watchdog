"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { WarningWidget } from "@/components/dashboard/WarningWidget"
import { AISummary } from "@/components/dashboard/SituationSummary"
import { VideoFeed } from "@/components/dashboard/VideoFeed"
import { PersonLocator } from "@/components/dashboard/PersonLocator"
import { useOvershootVision } from "@/app/overshoot"

export default function DashboardPage() {
  // Get the current user's Clerk ID for SMS alerts
  const { userId: clerkId } = useAuth()
  
  const username = "User"
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
  } = useOvershootVision({ clerkId })

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
    <div className="min-h-screen bg-background p-6 sm:p-8 lg:p-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-light text-foreground mb-8">
          Welcome {username}.
        </h1>

        <div className="flex flex-row gap-4 sm:gap-6 mb-4 sm:mb-6 min-h-[30vh]">
          <WarningWidget level={overallDangerLevel} since={dangerSince} />
          <AISummary
            title="AI Summary of Ongoing Situation"
            sections={sections}
          />
        </div>

        <div className="flex flex-row gap-4 sm:gap-6 min-h-[60vh]">
          <div className="flex flex-col flex-1 gap-3">
            <div className="relative rounded-lg overflow-hidden">
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
              className="self-start px-4 py-2 text-xs sm:text-sm bg-danger text-foreground border border-[#000000] border-[0.0625rem]"
            >
              {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
            </button>
          </div>
          <PersonLocator grid={combinedPersonGrid} />
        </div>
      </div>
    </div>
  )
}