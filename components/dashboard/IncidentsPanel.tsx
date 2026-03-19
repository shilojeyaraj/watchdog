"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { IncidentPriority, IncidentStatus } from "@/lib/db-incidents"

type IncidentsRow = {
  id: string
  status: IncidentStatus
  priority: IncidentPriority
  title: string
  description: string | null
  detected_at: string | Date
  resolved_at: string | Date | null
  camera_id: string | null
  first_event_id: string
  detection_section: "farthest" | "middle" | "closest" | null
}

type SortKey = "detected_at" | "priority" | "status" | "title" | "location"
type SortDir = "asc" | "desc"

const PRIORITY_ORDER: Record<IncidentPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const STATUS_ORDER: Record<IncidentStatus, number> = {
  open: 1,
  acknowledged: 2,
  responding: 3,
  resolved: 4,
  false_alarm: 0,
}

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function statusPillClass(status: IncidentStatus) {
  switch (status) {
    case "open":
      return "bg-white/5 border-white/10 text-white/80"
    case "acknowledged":
      return "bg-blue-500/15 border-blue-500/25 text-blue-200"
    case "responding":
      return "bg-purple-500/15 border-purple-500/25 text-purple-200"
    case "resolved":
      return "bg-emerald-500/15 border-emerald-500/25 text-emerald-200"
    case "false_alarm":
      return "bg-amber-500/15 border-amber-500/25 text-amber-200"
  }
}

function priorityPillClass(priority: IncidentPriority) {
  switch (priority) {
    case "critical":
      return "bg-red-500/15 border-red-500/25 text-red-200"
    case "high":
      return "bg-orange-500/15 border-orange-500/25 text-orange-200"
    case "medium":
      return "bg-amber-500/15 border-amber-500/25 text-amber-200"
    case "low":
      return "bg-emerald-500/15 border-emerald-500/25 text-emerald-200"
  }
}

export function IncidentsPanel({ isMonitoring }: { isMonitoring: boolean }) {
  const [incidents, setIncidents] = useState<IncidentsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>("detected_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const abortRef = useRef<AbortController | null>(null)

  const fetchIncidents = async () => {
    try {
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      setLoading(true)
      setError(null)

      const res = await fetch(`/api/incidents?limit=200`, {
        method: "GET",
        signal: abortRef.current.signal,
        cache: "no-store",
      })

      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to load incidents (${res.status})`)
      }

      setIncidents(Array.isArray(data.incidents) ? data.incidents : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Avoid spamming UI while monitoring; keep last result.
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial load
    fetchIncidents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isMonitoring) return
    const id = setInterval(() => {
      fetchIncidents()
    }, 20000) // refresh while monitoring (20s)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoring])

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1

    const getLocationLabel = (i: IncidentsRow) => {
      const section = i.detection_section ? `Section: ${i.detection_section}` : "Section: —"
      const camera = i.camera_id ? `Camera: ${i.camera_id}` : "Camera: —"
      return `${section} • ${camera}`
    }

    const rows = [...incidents]
    rows.sort((a, b) => {
      if (sortKey === "detected_at") {
        const ta =
          typeof a.detected_at === "string" ? new Date(a.detected_at).getTime() : a.detected_at.getTime()
        const tb =
          typeof b.detected_at === "string" ? new Date(b.detected_at).getTime() : b.detected_at.getTime()
        return (ta - tb) * dir
      }
      if (sortKey === "priority") {
        return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir
      }
      if (sortKey === "status") {
        return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir
      }
      if (sortKey === "title") {
        return a.title.localeCompare(b.title) * dir
      }
      if (sortKey === "location") {
        return getLocationLabel(a).localeCompare(getLocationLabel(b)) * dir
      }
      return 0
    })

    return rows
  }, [incidents, sortDir, sortKey])

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDir(key === "detected_at" ? "desc" : "asc")
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-lg font-semibold text-white">Incidents</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchIncidents}
            className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/30 rounded-sm transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 text-xs text-amber-200/90">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-black/60 backdrop-blur z-10">
              <tr className="text-xs uppercase tracking-wider text-white/60">
                <th className="px-3 py-2 cursor-pointer" onClick={() => onSort("title")}>Title</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => onSort("location")}>Location</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => onSort("priority")}>Priority</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => onSort("status")}>Status</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => onSort("detected_at")}>Detected</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && !loading ? (
                <tr>
                  <td className="px-3 py-6 text-white/50" colSpan={6}>
                    No incidents yet.
                  </td>
                </tr>
              ) : (
                sorted.map((i) => {
                  const sectionLabel = i.detection_section ?? "—"
                  const cameraLabel = i.camera_id ?? "—"
                  return (
                    <tr key={i.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-3">
                        <div className="font-medium text-white/90">{i.title}</div>
                        <div className="text-xs text-white/50">ID: {i.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-3 py-3 text-white/70">
                        <div>Section: {sectionLabel}</div>
                        <div className="text-xs text-white/50">Camera: {cameraLabel}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                            priorityPillClass(i.priority),
                          ].join(" ")}
                        >
                          {i.priority}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                            statusPillClass(i.status),
                          ].join(" ")}
                        >
                          {i.status}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-white/70">{formatDate(i.detected_at)}</td>
                      <td className="px-3 py-3 text-white/60 max-w-[420px]">
                        {i.description || "—"}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

