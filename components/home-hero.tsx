"use client";

import { useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { BackgroundCircles } from "@/components/ui/background-circles";

type ThreatLevel = "safe" | "warning" | "danger";

const CYCLE: ThreatLevel[] = ["safe", "warning", "danger"];
const INTERVAL_MS = 2500;

export function HomeHero() {
  const [levelIndex, setLevelIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLevelIndex((i) => (i + 1) % CYCLE.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <BackgroundCircles
      title="Welcome to Watchdog."
      subtitle="Threat Detection and Mapping for First Responders"
      level={CYCLE[levelIndex]}
    >
      <SignedOut>
        <div className="flex flex-col gap-4 items-center">
          <SignInButton mode="modal">
            <button className="px-8 py-3 bg-white/10 text-white font-medium hover:bg-white/20 transition-colors border border-white/30 rounded-sm backdrop-blur-sm">
              Sign In
            </button>
          </SignInButton>
          <p className="text-sm text-white/50">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-white/80 underline">
              Sign up
            </Link>
          </p>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex flex-col gap-4 items-center">
          <p className="text-white/70 text-center mb-2">
            You&apos;re signed in. Go to your dashboard.
          </p>
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-white/10 text-white font-medium hover:bg-white/20 transition-colors border border-white/30 rounded-sm backdrop-blur-sm"
          >
            Go to Dashboard
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
    </BackgroundCircles>
  );
}
