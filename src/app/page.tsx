export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F9FAFB]">
      <section className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-blue-500/10 backdrop-blur">
            <span className="text-2xl font-bold text-[#3B82F6]">N</span>
          </div>

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.35em] text-[#3B82F6]">
            Nexora Home
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Intelligent smart home control, built for calm living.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#9CA3AF] sm:text-lg">
            A premium IoT dashboard for monitoring devices, rooms, automation,
            energy usage, and real-time home alerts from one beautiful interface.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/dashboard"
              className="rounded-full bg-[#3B82F6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500"
            >
              Open Dashboard
            </a>

            <a
              href="#preview"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View Preview
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}