import { ParserApp } from "@/components/parser-app";

export default function Page() {
  return (
    <main className="app-shell grid-lines">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-10">
        <section className="mb-8 flex flex-col gap-6 pt-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
              Production-ready metadata extraction
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Spotify Link Parser
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
              Parse Spotify URLs and URIs into clean, structured metadata for tracks,
              albums, artists, and authorized playlist imports.
            </p>
          </div>
          <div className="glass rounded-3xl px-5 py-4 text-sm text-[color:var(--muted)]">
            Playlist imports only run with a connected Spotify user session.
          </div>
        </section>
        <ParserApp />
      </div>
    </main>
  );
}
