export function CreatedBySection() {
  return (
    <section
      id="created-by"
      className="min-h-screen flex flex-col items-center justify-center bg-black border-t border-white/10 px-6 py-24"
    >
      <div className="max-w-2xl w-full text-center flex flex-col items-center gap-6">
        <p className="text-xs uppercase tracking-widest text-white/30 font-medium">
          Created By
        </p>
        <h2 className="text-4xl sm:text-5xl font-light text-white tracking-tight">
          Shilo Jeyaraj
        </h2>
        <p className="text-white/50 text-base max-w-md">
          Watchdog was built as a real-time threat detection platform for first
          responders - combining AI video analysis, live mapping, and automated
          alerting into a single command centre.
        </p>
        <div className="w-12 h-px bg-white/20 mt-2" />
        <p className="text-white/30 text-sm">
          Built with Next.js, Socket.IO, Clerk, Neon PostgreSQL, and Twilio.
        </p>
      </div>
    </section>
  );
}
