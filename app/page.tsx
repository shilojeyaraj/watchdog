import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="w-full max-w-xl p-6">
        <h1 className="text-4xl sm:text-5xl font-light text-black mb-7 text-center">
          Welcome to Watchdog.
        </h1>
        <h1 className="text-l sm:text-l mb-10 text-center text-black">
          Threat Detection and Mapping for First Responders
        </h1>
        
        <SignedOut>
          <div className="flex flex-col gap-4 w-full">
            <SignInButton mode="modal">
              <button className="w-full px-6 py-4 rounded-2xl bg-card border border-[#000000] border-[0.0625rem] text-foreground text-lg hover:bg-gray-50 transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="w-full px-6 py-4 rounded-2xl bg-[#6c47ff] text-white text-lg hover:bg-[#5a3dd6] transition-colors">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </SignedOut>
        
        <SignedIn>
          <div className="flex flex-col gap-4 w-full">
            <Link 
              href="/dashboard"
              className="w-full px-6 py-4 rounded-2xl bg-[#6c47ff] text-white text-lg text-center hover:bg-[#5a3dd6] transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
