export type SpotifyResourceType = "track" | "album" | "artist" | "playlist";

export type AnalyticsEventName =
  | "parse_clicked"
  | "parse_succeeded"
  | "parse_failed"
  | "copy_json_clicked"
  | "export_csv_clicked"
  | "connect_spotify_clicked"
  | "manual_import_completed"
  | "csv_upload_completed";

export interface NormalizedTrackRow {
  source_type: "track" | "album" | "playlist";
  source_url: string;
  source_id: string;
  position: number | null;
  artist_name: string;
  track_title: string;
  album_name: string | null;
  track_number: number | null;
  disc_number: number | null;
  duration_ms: number | null;
  spotify_track_url: string | null;
}

export interface ManualImportItem extends NormalizedTrackRow {}

export interface ArtistResponse {
  id: string;
  name: string;
  genres: string[];
  followers: number | null;
  popularity: number | null;
  spotifyUrl: string | null;
  imageUrl: string | null;
}

export interface SuccessParseResponse {
  resourceType: SpotifyResourceType;
  mode: "success";
  sourceUrl: string;
  sourceId: string;
  items?: NormalizedTrackRow[];
  artist?: ArtistResponse;
  warnings?: string[];
}

export interface PlaylistFallbackResponse {
  resourceType: "playlist";
  mode: "fallback";
  sourceUrl: string;
  sourceId: string;
  message: string;
  detail: string;
  actions: string[];
}

export type ParseApiResponse = SuccessParseResponse | PlaylistFallbackResponse;

export interface SpotifySessionStatus {
  connected: boolean;
  expiresAt?: number | null;
}

export interface ParsedSpotifyInput {
  resourceType: SpotifyResourceType;
  id: string;
  canonicalUrl: string;
}

export interface SpotifyUserSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
