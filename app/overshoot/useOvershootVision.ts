"use client"

import { useEffect, useState, useRef } from "react"
import { parseOvershootResult } from "./parseOvershootResult"
import type {
  DangerLevel,
  OvershootResult,
  OvershootVisionConstructor,
  OvershootVisionInstance,
} from "./types"

const createSectionPrompt = (section: string) => {
  const rowMapping = {
    farthest: "rows 0-2",
    middle: "rows 3-5",
    closest: "rows 6-9"
  }[section] || "rows 0-9"

  return `You are monitoring a CCTV feed inside a room, focusing on the ${section} section from the camera.

Level = "DANGER" if there is any physical fight, aggressive gestures (hitting, pushing, frantic arm movements), hands on neck, gun-like gesture near head, or distress caused by another person; "WARNING" if no fight but someone appears shocked or scared; "SAFE" if everyone is calm.

Respond ONLY with a JSON object: {"level": "SAFE" | "WARNING" | "DANGER", "summary": string, "points": [[x, y], ...]} explaining the choice.

Points are integer coordinates (0–9) for each person on a 10×10 bird's-eye grid of the room, focusing on the ${section} section. Map coordinates to ${rowMapping}.

Focus your assessment ONLY on the ${section} section from the camera.`
}

const SECTION_PROMPTS = {
  farthest: createSectionPrompt("farthest"),
  middle: createSectionPrompt("middle"),
  closest: createSectionPrompt("closest"),
} as const

type SectionResult = {
  summary: string
  grid: boolean[][]
  level: DangerLevel
  rawText: string
}

type UseOvershootVisionResult = {
  sections: {
    farthest: SectionResult | null
    middle: SectionResult | null
    closest: SectionResult | null
  }
  overallDangerLevel: DangerLevel
  dangerSince: Date
  isMonitoring: boolean
  setIsMonitoring: (value: boolean | ((prev: boolean) => boolean)) => void
  setStream: (stream: MediaStream | null) => void
}

// Props for the hook - now accepts clerkId for user-specific alerts
type UseOvershootVisionProps = {
  clerkId?: string | null
}

export function useOvershootVision(props?: UseOvershootVisionProps): UseOvershootVisionResult {
  const clerkId = props?.clerkId
  
  const [sections, setSections] = useState<{
    farthest: SectionResult | null
    middle: SectionResult | null
    closest: SectionResult | null
  }>({
    farthest: null,
    middle: null,
    closest: null,
  })
  const [overallDangerLevel, setOverallDangerLevel] = useState<DangerLevel>("SAFE")
  const [dangerSince, setDangerSince] = useState<Date>(new Date())
  const [isMonitoring, setIsMonitoring] = useState(false)
  
  // Track last alert sent to avoid duplicate API calls
  const lastAlertRef = useRef<{ level: DangerLevel; time: number }>({ level: "SAFE", time: 0 })
  const visionsRef = useRef<OvershootVisionInstance[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Effect to send SMS alerts when danger level changes
  useEffect(() => {
    if (!isMonitoring) return
    if (!clerkId) {
      console.log('[OVERSHOOT] No clerkId provided - SMS alerts disabled')
      return
    }

    const now = Date.now()
    const lastAlert = lastAlertRef.current
    
    // Only send alert if:
    // 1. Danger level is WARNING or DANGER
    // 2. It's different from the last alert we sent OR it's been more than 5 seconds
    const shouldSendAlert = 
      (overallDangerLevel === 'WARNING' || overallDangerLevel === 'DANGER') &&
      (lastAlert.level !== overallDangerLevel || now - lastAlert.time > 5000)

    if (!shouldSendAlert) return

    // Get the combined summary from all sections
    const summaries = [
      sections.closest?.summary,
      sections.middle?.summary,
      sections.farthest?.summary
    ].filter(Boolean).join(' ')

    console.log('[OVERSHOOT] Sending SMS alert:', {
      dangerLevel: overallDangerLevel,
      clerkId,
      summary: summaries.substring(0, 100) + '...'
    })

    // Update ref to track this alert
    lastAlertRef.current = { level: overallDangerLevel, time: now }

    // Send alert to SMS API
    fetch('/api/sms/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dangerLevel: overallDangerLevel,
        description: summaries || 'Potential threat detected by AI monitoring',
        clerkId
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('[OVERSHOOT] SMS API response:', data)
      })
      .catch(err => {
        console.error('[OVERSHOOT] SMS API error:', err)
      })

  }, [overallDangerLevel, isMonitoring, clerkId, sections])

  useEffect(() => {
    // CRITICAL: Stop all existing instances FIRST before creating new ones
    const stopAllVisions = async () => {
      const visions = visionsRef.current
      if (visions.length > 0) {
        console.log(`[RealtimeVision] Stopping ${visions.length} existing vision instances...`)
        await Promise.all(
          visions.map(vision => 
            vision.stop().catch((err) => {
              console.error('[RealtimeVision] Error stopping vision:', err)
            })
          )
        )
        visionsRef.current = []
        // Small delay to ensure streams are fully closed
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    if (!isMonitoring || !stream) {
      // Stop all visions when monitoring stops or stream is not available
      stopAllVisions()
      return
    }

    let cancelled = false

    async function run() {
      // Stop any existing instances first
      await stopAllVisions()

      if (cancelled) {
        return
      }

      const apiKey = process.env.NEXT_PUBLIC_OVERSHOOT_API_KEY

      if (!apiKey) {
        console.error('[RealtimeVision] API key not found')
        return
      }

      const sdkModule = (await import("@overshoot/sdk")) as {
        RealtimeVision: OvershootVisionConstructor
      }

      if (cancelled) {
        return
      }

      const { RealtimeVision } = sdkModule
      const sectionKeys = ['farthest', 'middle', 'closest'] as const
      const newVisions: OvershootVisionInstance[] = []

      // Create and start 3 separate instances
      for (const section of sectionKeys) {
        if (cancelled) {
          // Stop any instances we've created so far
          for (const vision of newVisions) {
            await vision.stop().catch(() => {})
          }
          return
        }

        try {
          const instance = new RealtimeVision({
            apiUrl: "https://cluster1.overshoot.ai/api/v0.2",
            apiKey,
            prompt: SECTION_PROMPTS[section],
            onResult: (result: OvershootResult) => {
              if (cancelled) {
                return
              }

              const text =
                typeof result.result === "string" ? result.result : ""

              if (!text.trim()) {
                return
              }

              const parsed = parseOvershootResult(text)

              if (!parsed) {
                return
              }

              console.log(`${section} section description:`, parsed.summary)

              setSections(prev => ({
                ...prev,
                [section]: {
                  summary: parsed.summary,
                  grid: parsed.grid,
                  level: parsed.level,
                  rawText: text,
                }
              }))

              // Update overall danger level based on the highest danger level across sections
              setSections(currentSections => {
                const allLevels = Object.values(currentSections)
                  .filter(s => s !== null)
                  .map(s => s!.level)

                const highestLevel = allLevels.includes("DANGER") ? "DANGER" :
                                   allLevels.includes("WARNING") ? "WARNING" : "SAFE"

                setOverallDangerLevel(highestLevel)
                setDangerSince(new Date())

                return currentSections
              })
            },
          })

          newVisions.push(instance)
          // Pass the stream to start() - this is required!
          await instance.start(stream)
          console.log(`[RealtimeVision] Started ${section} instance`)
        } catch (error) {
          console.error(`[RealtimeVision] Error creating/starting ${section} instance:`, error)
          // Stop all instances we've created so far if one fails
          for (const vision of newVisions) {
            try {
              await vision.stop()
            } catch (e) {
              // Ignore errors
            }
          }
          return
        }
      }

      // Only update ref if we successfully created all instances
      if (!cancelled && newVisions.length === 3) {
        visionsRef.current = newVisions
        console.log('[RealtimeVision] All 3 vision instances started successfully')
      }
    }

    run().catch((error) => {
      console.error('[RealtimeVision] Fatal error:', error)
    })

    return () => {
      cancelled = true
      // CRITICAL: Stop all vision instances to free up stream slots
      stopAllVisions()
    }
  }, [isMonitoring, stream])

  return {
    sections,
    overallDangerLevel,
    dangerSince,
    isMonitoring,
    setIsMonitoring,
    setStream,
  }
}