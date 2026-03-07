"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/#about" },
  { label: "Created By", href: "/about" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 bg-black border-b border-white/20">
      {/* Logo */}
      <Link
        href="/"
        className="text-white font-semibold tracking-wide text-sm uppercase"
      >
        Watchdog
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              pathname === link.href
                ? "text-white bg-white/10"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Auth */}
      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="text-sm text-white/60 hover:text-white transition-colors">
              Sign In
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="[&_img]:grayscale [&_img]:brightness-90 [&_button]:ring-0">
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </div>
    </header>
  );
}
