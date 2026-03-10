"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = ["hero", "about", "created-by"];

export function ScrollNav() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach((id, index) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIndex(index);
        },
        { threshold: 0.4 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = (index: number) => {
    document.getElementById(SECTIONS[index])?.scrollIntoView({ behavior: "smooth" });
  };

  const btnClass =
    "flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-black/60 text-white/70 hover:text-white hover:border-white/50 hover:bg-black/80 backdrop-blur-sm transition-all";

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {activeIndex > 0 && (
        <button
          onClick={() => scrollTo(activeIndex - 1)}
          aria-label="Scroll to previous section"
          className={cn(btnClass)}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      )}
      {activeIndex < SECTIONS.length - 1 && (
        <button
          onClick={() => scrollTo(activeIndex + 1)}
          aria-label="Scroll to next section"
          className={cn(btnClass, "animate-bounce")}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
