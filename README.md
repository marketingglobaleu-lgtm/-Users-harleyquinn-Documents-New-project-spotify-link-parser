# Spotify Link Parser

Spotify Link Parser is a production-oriented Next.js app that accepts Spotify URLs and `spotify:` URIs, fetches structured metadata for tracks, albums, artists, and playlists, normalizes track-level output, and supports CSV export.

## Features

- Parse Spotify web URLs and `spotify:` URIs
- Detect `track`, `album`, `artist`, and `playlist`
- Fetch track metadata and normalize it into a stable schema
- Fetch album metadata plus all album tracks
- Fetch artist metadata
- Only attempt playlist track import when a Spotify user session exists
- Return controlled playlist fallback responses with manual paste and CSV upload alternatives
- Copy JSON and export CSV from the UI
- Server-only secret handling
- Structured logging and simple analytics events
- Mobile-friendly Tailwind UI
- Test coverage for URL parsing and normalization

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Route Handlers for server APIs
- `spotify-web-api-node`
- Vitest

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
cp .env.example .env.local
```

3. Fill in:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `APP_URL`
- `SESSION_ENCRYPTION_SECRET`

4. In your Spotify developer app, add the callback URL from `SPOTIFY_REDIRECT_URI`.

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Spotify Auth Notes

- Tracks, albums, and artists use app-level client credentials.
- Playlists require a connected Spotify user session.
- If a playlist cannot be accessed because no user session exists or Spotify returns `403`, the app returns a controlled fallback response instead of claiming success.

## Normalized Output Schema

Each normalized item uses:

- `source_type`
- `source_url`
- `source_id`
- `position`
- `artist_name`
- `track_title`
- `album_name`
- `track_number`
- `disc_number`
- `duration_ms`
- `spotify_track_url`

## Testing

Run:

```bash
npm test
```

Current tests cover:

- URL and URI parsing
- Normalization for track and album-like records

## Production Notes

- Secrets stay server-side only
- Spotify OAuth session is stored in an encrypted HTTP-only cookie
- API handlers map and return clear `400`, `401`, `403`, `404`, `429`, and `500` responses
- Logging is structured to make ingestion into log pipelines straightforward
