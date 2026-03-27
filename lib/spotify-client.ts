import "server-only";
import SpotifyWebApi from "spotify-web-api-node";
import { normalizeArtistMetadata } from "@/lib/normalize";

type SpotifyWebApiClient = any;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export class SpotifyApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function translateSpotifyError(error: unknown): never {
  const status = Number((error as { statusCode?: number })?.statusCode ?? 500);

  if (status === 400) {
    throw new SpotifyApiError(400, "bad_request", "Spotify rejected the request.");
  }
  if (status === 401) {
    throw new SpotifyApiError(401, "unauthorized", "Spotify authorization failed.");
  }
  if (status === 403) {
    throw new SpotifyApiError(403, "forbidden", "Spotify denied access to this resource.");
  }
  if (status === 404) {
    throw new SpotifyApiError(404, "not_found", "Spotify resource not found.");
  }
  if (status === 429) {
    throw new SpotifyApiError(429, "rate_limited", "Spotify rate limit exceeded. Try again shortly.");
  }

  throw new SpotifyApiError(500, "spotify_error", "Spotify request failed.");
}

export async function createSpotifyAppClient() {
  const client = new SpotifyWebApi({
    clientId: getRequiredEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: getRequiredEnv("SPOTIFY_CLIENT_SECRET"),
    redirectUri: getRequiredEnv("SPOTIFY_REDIRECT_URI")
  });

  try {
    const tokenResponse = await client.clientCredentialsGrant();
    client.setAccessToken(tokenResponse.body.access_token);
    return client;
  } catch (error) {
    translateSpotifyError(error);
  }
}

export function createSpotifyUserClient(accessToken: string) {
  const client = new SpotifyWebApi({
    clientId: getRequiredEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: getRequiredEnv("SPOTIFY_CLIENT_SECRET"),
    redirectUri: getRequiredEnv("SPOTIFY_REDIRECT_URI")
  });
  client.setAccessToken(accessToken);
  return client;
}

export async function getTrackMetadata(client: SpotifyWebApiClient, trackId: string) {
  try {
    const response = await client.getTrack(trackId);
    return response.body;
  } catch (error) {
    translateSpotifyError(error);
  }
}

export async function getAlbumWithTracks(client: SpotifyWebApiClient, albumId: string) {
  try {
    const albumResponse = await client.getAlbum(albumId);
    const initialAlbum = albumResponse.body;
    const items = [...initialAlbum.tracks.items];
    let offset = items.length;
    const total = initialAlbum.tracks.total;

    while (offset < total) {
      const page = await client.getAlbumTracks(albumId, {
        limit: 50,
        offset
      });
      items.push(...page.body.items);
      offset += page.body.items.length;
    }

    return {
      ...initialAlbum,
      tracks: {
        ...initialAlbum.tracks,
        items
      }
    };
  } catch (error) {
    translateSpotifyError(error);
  }
}

export async function getArtistMetadata(client: SpotifyWebApiClient, artistId: string) {
  try {
    const response = await client.getArtist(artistId);
    return normalizeArtistMetadata(response.body);
  } catch (error) {
    translateSpotifyError(error);
  }
}

export async function getPlaylistWithTracks(client: SpotifyWebApiClient, playlistId: string) {
  try {
    const playlistResponse = await client.getPlaylist(playlistId);
    const basePlaylist = playlistResponse.body;
    const items = [...basePlaylist.tracks.items];
    let offset = items.length;
    const total = basePlaylist.tracks.total;

    while (offset < total) {
      const page = await client.getPlaylistTracks(playlistId, {
        limit: 100,
        offset
      });
      items.push(...page.body.items);
      offset += page.body.items.length;
    }

    return {
      ...basePlaylist,
      tracks: {
        ...basePlaylist.tracks,
        items
      }
    };
  } catch (error) {
    translateSpotifyError(error);
  }
}
