"use client"

interface WarningWidgetProps {
  level?: "SAFE" | "WARNING" | "DANGER"
  since?: Date
}

export function WarningWidget({
  level = "DANGER",
  since = new Date("2026-01-17T16:00:00")
}: WarningWidgetProps) {
  const colorClass =
    level === "SAFE"
      ? "text-emerald-400"
      : level === "WARNING"
      ? "text-amber-400"
      : "text-red-500"

  const borderClass =
    level === "SAFE"
      ? "border-emerald-500/30"
      : level === "WARNING"
      ? "border-amber-400/30"
      : "border-red-500/30"

  const formattedDate = since.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const formattedTime = since.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  return (
    <div className={`flex-1 sm:basis-1/3 rounded-lg border ${borderClass} bg-white/5 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 min-h-[100px]`}>
      <div className="flex flex-col items-center justify-center">
        <div className={`text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight ${colorClass}`}>
          {level}
        </div>
        <div className="text-white/40 mt-2 text-xs sm:text-sm">
          Since: {formattedDate}, {formattedTime}
        </div>
      </div>
    </div>
  )
}
