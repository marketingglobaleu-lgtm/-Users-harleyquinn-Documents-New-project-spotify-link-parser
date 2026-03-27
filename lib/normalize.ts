import type { ArtistResponse, NormalizedTrackRow } from "@/lib/types";

interface SimplifiedArtist {
  name: string;
}

interface SimplifiedAlbum {
  id: string;
  name: string;
  external_urls?: {
    spotify?: string;
  };
}

interface SimplifiedTrack {
  id: string;
  name: string;
  duration_ms: number;
  track_number: number;
  disc_number: number;
  artists: SimplifiedArtist[];
  album?: SimplifiedAlbum;
  external_urls?: {
    spotify?: string;
  };
}

interface SimplifiedAlbumTrack {
  id: string;
  name: string;
  duration_ms: number;
  track_number: number;
  disc_number: number;
  artists: SimplifiedArtist[];
  external_urls?: {
    spotify?: string;
  };
}

interface SimplifiedAlbumWithTracks {
  id: string;
  name: string;
  tracks: {
    items: SimplifiedAlbumTrack[];
  };
}

interface SimplifiedPlaylistTrack {
  track: SimplifiedTrack | null;
}

interface SimplifiedPlaylistWithTracks {
  id: string;
  tracks: {
    items: SimplifiedPlaylistTrack[];
  };
}

export function normalizeTrack(track: SimplifiedTrack, sourceUrl: string): NormalizedTrackRow {
  return {
    source_type: "track",
    source_url: sourceUrl,
    source_id: track.id,
    position: 1,
    artist_name: track.artists.map((artist) => artist.name).join(", "),
    track_title: track.name,
    album_name: track.album?.name ?? null,
    track_number: track.track_number ?? null,
    disc_number: track.disc_number ?? null,
    duration_ms: track.duration_ms ?? null,
    spotify_track_url: track.external_urls?.spotify ?? null
  };
}

export function normalizeAlbumTracks(
  album: SimplifiedAlbumWithTracks,
  sourceUrl: string
): NormalizedTrackRow[] {
  return album.tracks.items.map((track, index) => ({
    source_type: "album",
    source_url: sourceUrl,
    source_id: album.id,
    position: index + 1,
    artist_name: track.artists.map((artist) => artist.name).join(", "),
    track_title: track.name,
    album_name: album.name,
    track_number: track.track_number ?? null,
    disc_number: track.disc_number ?? null,
    duration_ms: track.duration_ms ?? null,
    spotify_track_url: track.external_urls?.spotify ?? null
  }));
}

export function normalizePlaylistTracks(
  playlist: SimplifiedPlaylistWithTracks,
  sourceUrl: string
): NormalizedTrackRow[] {
  const rows = playlist.tracks.items
    .map((item, index) => {
      const track = item.track;
      if (!track) return null;

      return {
        source_type: "playlist" as const,
        source_url: sourceUrl,
        source_id: playlist.id,
        position: index + 1,
        artist_name: track.artists.map((artist) => artist.name).join(", "),
        track_title: track.name,
        album_name: track.album?.name ?? null,
        track_number: track.track_number ?? null,
        disc_number: track.disc_number ?? null,
        duration_ms: track.duration_ms ?? null,
        spotify_track_url: track.external_urls?.spotify ?? null
      };
    })
    .filter((item): item is NormalizedTrackRow => Boolean(item));

  return rows;
}

export function normalizeArtistMetadata(artist: {
  id: string;
  name: string;
  genres?: string[];
  followers?: {
    total?: number;
  };
  popularity?: number;
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{ url: string }>;
}): ArtistResponse {
  return {
    id: artist.id,
    name: artist.name,
    genres: artist.genres ?? [],
    followers: artist.followers?.total ?? null,
    popularity: artist.popularity ?? null,
    spotifyUrl: artist.external_urls?.spotify ?? null,
    imageUrl: artist.images?.[0]?.url ?? null
  };
}
