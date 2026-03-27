"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import type {
  AnalyticsEventName,
  ArtistResponse,
  ManualImportItem,
  ParseApiResponse,
  PlaylistFallbackResponse,
  SpotifySessionStatus
} from "@/lib/types";

const EXAMPLE_INPUTS = [
  "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
  "spotify:album:4aawyAB9vmqN3uQ7FjRGTy",
  "https://open.spotify.com/artist/66CXWjxzNUsdJxJ2JdwvnR"
];

function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>) {
  void fetch("/api/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      payload
    })
  }).catch(() => undefined);
}

function formatMs(durationMs: number | null) {
  if (!durationMs) return "N/A";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseManualLine(line: string, sourceUrl?: string): ManualImportItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const [artistName, ...titleParts] = trimmed.split(" - ");
  const trackTitle = titleParts.join(" - ").trim();

  return {
    source_type: "playlist",
    source_url: sourceUrl ?? "manual://import",
    source_id: "manual-import",
    position: null,
    artist_name: artistName?.trim() || "Unknown Artist",
    track_title: trackTitle || trimmed,
    album_name: null,
    track_number: null,
    disc_number: null,
    duration_ms: null,
    spotify_track_url: null
  };
}

function getArtistMetaSafe(response: ParseApiResponse | null): ArtistResponse | null {
  if (!response || response.resourceType !== "artist") {
    return null;
  }

  return response.artist ?? null;
}

export function ParserApp() {
  const [input, setInput] = useState(EXAMPLE_INPUTS[0]);
  const [response, setResponse] = useState<ParseApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [showManualImport, setShowManualImport] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SpotifySessionStatus>({
    connected: false
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void fetch("/api/auth/spotify/status")
      .then(async (res) => res.json())
      .then((data: SpotifySessionStatus) => setSessionStatus(data))
      .catch(() => setSessionStatus({ connected: false }));
  }, []);

  const normalizedItems = useMemo(() => {
    if (!response) return [];
    if ("items" in response && Array.isArray(response.items)) {
      return response.items;
    }
    return [];
  }, [response]);

  const playlistFallback = useMemo(() => {
    if (response?.resourceType === "playlist" && response.mode === "fallback") {
      return response as PlaylistFallbackResponse;
    }
    return null;
  }, [response]);

  const artist = useMemo(() => getArtistMetaSafe(response), [response]);

  async function handleParse() {
    setError(null);
    trackEvent("parse_clicked");

    startTransition(async () => {
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input
          })
        });

        const data = (await res.json()) as ParseApiResponse | { error?: string };

        if (!res.ok) {
          const apiError =
            "error" in data && data.error ? data.error : "Unable to parse that Spotify resource.";
          setResponse(null);
          setError(apiError);
          trackEvent("parse_failed", { status: res.status });
          return;
        }

        setResponse(data as ParseApiResponse);
        setShowManualImport(false);
        trackEvent("parse_succeeded", {
          resourceType: (data as ParseApiResponse).resourceType
        });
      } catch {
        setResponse(null);
        setError("Network error while parsing the Spotify resource.");
        trackEvent("parse_failed", { status: 0 });
      }
    });
  }

  async function handleCopyJson() {
    if (!response) return;
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    trackEvent("copy_json_clicked");
  }

  function handleExportCsv() {
    if (!normalizedItems.length) return;
    const csv = buildCsv(normalizedItems);
    downloadCsvFile("spotify-link-parser-export.csv", csv);
    trackEvent("export_csv_clicked", { count: normalizedItems.length });
  }

  function handleManualImport() {
    const items = manualText
      .split("\n")
      .map((line) => parseManualLine(line, playlistFallback?.sourceUrl))
      .filter((item): item is ManualImportItem => Boolean(item))
      .map((item, index) => ({
        ...item,
        position: index + 1
      }));

    setResponse({
      resourceType: "playlist",
      mode: "success",
      sourceUrl: playlistFallback?.sourceUrl ?? "manual://import",
      sourceId: playlistFallback?.sourceId ?? "manual-import",
      items,
      warnings: ["This result was created from manual input, not fetched from Spotify."]
    });
    trackEvent("manual_import_completed", { count: items.length });
  }

  function handleCsvUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const rows = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!rows.length) {
        setError("The uploaded CSV file was empty.");
        return;
      }

      const firstRow = rows[0].toLowerCase();
      const hasHeader = firstRow.includes("artist") || firstRow.includes("track");
      const lines = hasHeader ? rows.slice(1) : rows;
      const items = lines
        .map((line) => {
          const columns = line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
          const [artistName, trackTitle, albumName] = columns;
          if (!artistName && !trackTitle) return null;

          return {
            source_type: "playlist" as const,
            source_url: playlistFallback?.sourceUrl ?? "manual://csv-import",
            source_id: playlistFallback?.sourceId ?? "csv-import",
            position: null,
            artist_name: artistName || "Unknown Artist",
            track_title: trackTitle || artistName,
            album_name: albumName || null,
            track_number: null,
            disc_number: null,
            duration_ms: null,
              spotify_track_url: null
            };
          })
        .filter(
          (
            item
          ): item is {
            source_type: "playlist";
            source_url: string;
            source_id: string;
            position: null;
            artist_name: string;
            track_title: string;
            album_name: string | null;
            track_number: null;
            disc_number: null;
            duration_ms: null;
            spotify_track_url: null;
          } => Boolean(item)
        )
        .map((item, index) => ({
          ...item,
          position: index + 1
        }));

      setResponse({
        resourceType: "playlist",
        mode: "success",
        sourceUrl: playlistFallback?.sourceUrl ?? "manual://csv-import",
        sourceId: playlistFallback?.sourceId ?? "csv-import",
        items,
        warnings: ["This result was created from CSV input, not fetched from Spotify."]
      });
      trackEvent("csv_upload_completed", { count: items.length });
    };
    reader.readAsText(file);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="glass rounded-[2rem] p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Paste a Spotify URL or URI</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
              Supports tracks, albums, artists, and playlists. Public playlist import is
              only attempted after Spotify authorization.
            </p>
          </div>
          <a
            href="/api/auth/spotify/connect"
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-white/70"
            onClick={() => trackEvent("connect_spotify_clicked")}
          >
            Connect Spotify
          </a>
        </div>

        <label className="mb-2 block text-sm font-medium">Spotify link</label>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={4}
          placeholder="https://open.spotify.com/track/..."
          className="w-full rounded-3xl border border-[color:var(--border)] bg-white/70 px-4 py-4 text-sm outline-none ring-0 transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)]"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_INPUTS.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted)] transition hover:bg-white/80"
              onClick={() => setInput(example)}
            >
              Use example
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleParse}
            disabled={isPending}
            className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Parsing..." : "Parse"}
          </button>
          <button
            type="button"
            onClick={handleCopyJson}
            disabled={!response}
            className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!normalizedItems.length}
            className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowManualImport((value) => !value)}
            className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium transition hover:bg-white/80"
          >
            Manual Import Instead
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl border border-[color:var(--border)] bg-white/50 p-4 text-sm text-[color:var(--muted)] sm:grid-cols-2">
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Spotify session</p>
            <p>{sessionStatus.connected ? "Connected" : "Not connected"}</p>
          </div>
          <div>
            <p className="font-medium text-[color:var(--foreground)]">Playlist import mode</p>
            <p>{sessionStatus.connected ? "Authorized import enabled" : "Fallback only"}</p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-3xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
            {error}
          </div>
        ) : null}

        {showManualImport ? (
          <div className="mt-6 rounded-[1.75rem] border border-[color:var(--border)] bg-white/60 p-4">
            <h3 className="text-lg font-semibold">Manual or CSV fallback import</h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Paste one track per line as <span className="font-medium">Artist - Title</span>,
              or upload a CSV with `artist,track,album`.
            </p>
            <textarea
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              rows={8}
              className="mt-4 w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-4 text-sm outline-none focus:border-[color:var(--accent)]"
              placeholder={"Taylor Swift - Style\nDaft Punk - Get Lucky"}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleManualImport}
                className="rounded-full bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-medium text-white"
              >
                Manual Import Instead
              </button>
              <label className="cursor-pointer rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium transition hover:bg-white/80">
                CSV upload
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleCsvUpload(file);
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <div className="glass rounded-[2rem] p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Parsed output</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Structured results, normalized rows, and controlled fallback states.
            </p>
          </div>
        </div>

        {!response ? (
          <div className="rounded-[1.75rem] border border-dashed border-[color:var(--border)] p-6 text-sm leading-6 text-[color:var(--muted)]">
            Parse a Spotify resource to see the normalized output here.
          </div>
        ) : null}

        {artist ? (
          <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-white/60 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Artist metadata
            </p>
            <h3 className="mt-3 text-2xl font-semibold">{artist.name}</h3>
            <div className="mt-4 grid gap-3 text-sm text-[color:var(--muted)] sm:grid-cols-2">
              <p>Followers: {artist.followers?.toLocaleString() ?? "N/A"}</p>
              <p>Popularity: {artist.popularity ?? "N/A"}</p>
              <p>Genres: {artist.genres.length ? artist.genres.join(", ") : "N/A"}</p>
              <p>
                Spotify URL:{" "}
                {artist.spotifyUrl ? (
                  <a
                    className="underline decoration-[color:var(--border)] underline-offset-4"
                    href={artist.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open artist
                  </a>
                ) : (
                  "N/A"
                )}
              </p>
            </div>
          </div>
        ) : null}

        {playlistFallback ? (
          <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-white/60 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Playlist fallback
            </p>
            <h3 className="mt-3 text-xl font-semibold">{playlistFallback.message}</h3>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {playlistFallback.detail}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {playlistFallback.actions.map((action) => (
                <span
                  key={action}
                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--muted)]"
                >
                  {action}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {response?.warnings?.length ? (
          <div className="mt-4 rounded-3xl border border-[color:var(--border)] bg-white/60 px-4 py-3 text-sm text-[color:var(--muted)]">
            {response.warnings.join(" ")}
          </div>
        ) : null}

        {normalizedItems.length ? (
          <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[color:var(--border)] bg-white/70">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-black/4 text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Artist</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Album</th>
                    <th className="px-4 py-3 font-medium">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedItems.map((item) => (
                    <tr key={`${item.source_id}-${item.position}-${item.track_title}`} className="border-t border-[color:var(--border)]">
                      <td className="px-4 py-3">{item.position ?? "—"}</td>
                      <td className="px-4 py-3">{item.artist_name}</td>
                      <td className="px-4 py-3">{item.track_title}</td>
                      <td className="px-4 py-3">{item.album_name ?? "—"}</td>
                      <td className="px-4 py-3">{formatMs(item.duration_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
