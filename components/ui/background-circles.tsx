"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ThreatLevel = "safe" | "warning" | "danger";

interface BackgroundCirclesProps {
  title: string;
  subtitle?: string;
  level?: ThreatLevel;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

const levelConfig: Record<
  ThreatLevel,
  {
    primary: string;
    rings: string[];
    dotGlow: string;
    aura: string;
    outerAura: string;
  }
> = {
  safe: {
    primary: "bg-emerald-500",
    rings: [
      "border-emerald-500/70",
      "border-emerald-500/50",
      "border-emerald-500/30",
    ],
    dotGlow:
      "shadow-[0_0_60px_30px_rgba(16,185,129,0.9),0_0_120px_60px_rgba(16,185,129,0.5),0_0_200px_100px_rgba(16,185,129,0.2)]",
    aura: "bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(16,185,129,0.25),transparent)]",
    outerAura:
      "bg-[radial-gradient(ellipse_100%_80%_at_50%_50%,rgba(16,185,129,0.10),transparent)]",
  },
  warning: {
    primary: "bg-amber-400",
    rings: [
      "border-amber-400/70",
      "border-amber-400/50",
      "border-amber-400/30",
    ],
    dotGlow:
      "shadow-[0_0_60px_30px_rgba(251,191,36,0.9),0_0_120px_60px_rgba(251,191,36,0.5),0_0_200px_100px_rgba(251,191,36,0.2)]",
    aura: "bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(251,191,36,0.25),transparent)]",
    outerAura:
      "bg-[radial-gradient(ellipse_100%_80%_at_50%_50%,rgba(251,191,36,0.10),transparent)]",
  },
  danger: {
    primary: "bg-red-500",
    rings: [
      "border-red-500/70",
      "border-red-500/50",
      "border-red-500/30",
    ],
    dotGlow:
      "shadow-[0_0_60px_30px_rgba(239,68,68,0.9),0_0_120px_60px_rgba(239,68,68,0.5),0_0_200px_100px_rgba(239,68,68,0.2)]",
    aura: "bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(239,68,68,0.25),transparent)]",
    outerAura:
      "bg-[radial-gradient(ellipse_100%_80%_at_50%_50%,rgba(239,68,68,0.10),transparent)]",
  },
};

export function BackgroundCircles({
  title,
  subtitle,
  level = "safe",
  className,
  id,
  children,
}: BackgroundCirclesProps) {
  const config = levelConfig[level];

  return (
    <div
      id={id}
      className={cn(
        "relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-black",
        className
      )}
    >
      {/* Gradient transition from black to white at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[50px] bg-gradient-to-b from-transparent via-black/60 via-black/30 via-black/10 to-background pointer-events-none z-20" />
      {/* Full-page outer aura - lights up the whole background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={level + "-outer-aura"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={cn("absolute inset-0 pointer-events-none", config.outerAura)}
        />
      </AnimatePresence>

      {/* Mid aura - tighter, more vibrant */}
      <AnimatePresence mode="wait">
        <motion.div
          key={level + "-aura"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className={cn("absolute inset-0 pointer-events-none", config.aura)}
        />
      </AnimatePresence>

      {/* Animated rings */}
      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          {/* Outer ring */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "absolute w-[700px] h-[700px] rounded-full border",
              config.rings[2]
            )}
          />
          {/* Middle ring */}
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            className={cn(
              "absolute w-[480px] h-[480px] rounded-full border",
              config.rings[1]
            )}
          />
          {/* Inner ring */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            className={cn(
              "absolute w-[290px] h-[290px] rounded-full border",
              config.rings[0]
            )}
          />
          {/* Center dot with heavy multi-layer glow */}
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "absolute w-10 h-10 rounded-full",
              config.primary,
              config.dotGlow
            )}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={level + "-content"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-3"
          >
            <h1 className="text-5xl sm:text-6xl font-light tracking-tight text-white drop-shadow-lg">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base sm:text-lg text-white/60 max-w-sm">
                {subtitle}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {children && <div className="mt-10">{children}</div>}
      </div>
    </div>
  );
}
