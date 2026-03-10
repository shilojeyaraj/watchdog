"use client"

interface SectionResult {
  summary: string
  grid: boolean[][]
  level: "SAFE" | "WARNING" | "DANGER"
  rawText: string
}

interface AISummaryProps {
  title?: string
  sections?: {
    farthest: SectionResult | null
    middle: SectionResult | null
    closest: SectionResult | null
  }
}

export function AISummary({
  title = "AI Brief Summary of What's going",
  sections
}: AISummaryProps) {
  const combinedSummary = sections
    ? [
        sections.closest?.summary,
        sections.middle?.summary,
        sections.farthest?.summary
      ].filter(Boolean).join('. ').replace(/\.$/, '') + '.'
    : "Longer description of ongoing danger, namely the cause, person(s), threat level, time of detection"

  return (
    <div className="flex-[2] sm:basis-2/3 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-4 sm:p-6 min-h-[100px]">
      <h3 className="text-sm sm:text-base font-semibold text-white/80 mb-2 uppercase tracking-widest">
        {title}
      </h3>
      <p className="text-white/60 leading-relaxed text-sm sm:text-base">{combinedSummary}</p>
    </div>
  )
}
