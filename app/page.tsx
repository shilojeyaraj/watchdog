import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="w-full max-w-xl p-6">
        <h1 className="text-4xl sm:text-5xl font-light text-black mb-7 text-center">
          Welcome to Watchdog.
        </h1>
        <h2 className="text-l sm:text-l mb-10 text-center text-black">
          Threat Detection and Mapping for First Responders
        </h2>
        
        <SignedOut>
          <div className="flex flex-col gap-4 items-center">
            <SignInButton mode="modal">
              <button className="px-8 py-3 bg-danger text-foreground font-medium hover:opacity-90 transition-opacity border border-[#000000] border-[0.0625rem]">
                Sign In
              </button>
            </SignInButton>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/sign-up" className="text-danger underline">
                Sign up
              </Link>
            </p>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col gap-4 items-center">
            <p className="text-center text-foreground mb-4">
              You're signed in! Go to your dashboard.
            </p>
            <Link 
              href="/dashboard"
              className="px-8 py-3 bg-danger text-foreground font-medium hover:opacity-90 transition-opacity border border-[#000000] border-[0.0625rem]"
            >
              Go to Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
