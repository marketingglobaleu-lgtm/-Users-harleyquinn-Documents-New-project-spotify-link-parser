import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAlbumTracks, normalizePlaylistTracks, normalizeTrack } from "@/lib/normalize";
import { getUserSession, refreshSpotifySessionIfNeeded } from "@/lib/spotify-session";
import {
  createSpotifyAppClient,
  createSpotifyUserClient,
  getAlbumWithTracks,
  getArtistMetadata,
  getPlaylistWithTracks,
  getTrackMetadata,
  SpotifyApiError
} from "@/lib/spotify-client";
import { logEvent } from "@/lib/logger";
import { parseSpotifyInput, SpotifyInputError } from "@/lib/spotify-url";
import type { ParseApiResponse } from "@/lib/types";

const requestSchema = z.object({
  input: z.string().min(1, "A Spotify URL or URI is required.")
});

function mapSpotifyError(error: unknown) {
  if (error instanceof SpotifyApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code
      },
      {
        status: error.status
      }
    );
  }

  return NextResponse.json(
    {
      error: "Unexpected server error."
    },
    {
      status: 500
    }
  );
}

function buildPlaylistFallback(parsed: ReturnType<typeof parseSpotifyInput>, detail: string): ParseApiResponse {
  return {
    resourceType: "playlist",
    mode: "fallback",
    sourceUrl: parsed.canonicalUrl,
    sourceId: parsed.id,
    message: "Playlist access requires Spotify user authorization.",
    detail,
    actions: ["Connect Spotify", "Manual paste of track list", "CSV upload"]
  };
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const parsed = parseSpotifyInput(body.input);

    logEvent("parse_request_received", {
      resourceType: parsed.resourceType,
      sourceId: parsed.id
    });

    const appClient = await createSpotifyAppClient();

    if (parsed.resourceType === "track") {
      const track = await getTrackMetadata(appClient, parsed.id);
      const response: ParseApiResponse = {
        resourceType: "track",
        mode: "success",
        sourceUrl: parsed.canonicalUrl,
        sourceId: parsed.id,
        items: [normalizeTrack(track, parsed.canonicalUrl)]
      };

      return NextResponse.json(response);
    }

    if (parsed.resourceType === "album") {
      const album = await getAlbumWithTracks(appClient, parsed.id);
      const response: ParseApiResponse = {
        resourceType: "album",
        mode: "success",
        sourceUrl: parsed.canonicalUrl,
        sourceId: parsed.id,
        items: normalizeAlbumTracks(album, parsed.canonicalUrl)
      };

      return NextResponse.json(response);
    }

    if (parsed.resourceType === "artist") {
      const artist = await getArtistMetadata(appClient, parsed.id);
      const response: ParseApiResponse = {
        resourceType: "artist",
        mode: "success",
        sourceUrl: parsed.canonicalUrl,
        sourceId: parsed.id,
        artist
      };

      return NextResponse.json(response);
    }

    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        buildPlaylistFallback(
          parsed,
          "Connect Spotify to attempt a playlist import. Without user authorization, the app will not promise playlist parsing for arbitrary public playlist links."
        )
      );
    }

    const refreshedSession = await refreshSpotifySessionIfNeeded(session);
    const userClient = createSpotifyUserClient(refreshedSession.accessToken);

    try {
      const playlist = await getPlaylistWithTracks(userClient, parsed.id);
      const response: ParseApiResponse = {
        resourceType: "playlist",
        mode: "success",
        sourceUrl: parsed.canonicalUrl,
        sourceId: parsed.id,
        items: normalizePlaylistTracks(playlist, parsed.canonicalUrl)
      };

      return NextResponse.json(response);
    } catch (error) {
      if (error instanceof SpotifyApiError && error.status === 403) {
        return NextResponse.json(
          buildPlaylistFallback(
            parsed,
            "Spotify denied playlist track access for this session. You can connect a different Spotify account, paste the track list manually, or upload a CSV instead."
          )
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid request."
        },
        {
          status: 400
        }
      );
    }

    if (error instanceof SpotifyInputError) {
      return NextResponse.json(
        {
          error: error.message
        },
        {
          status: 400
        }
      );
    }

    return mapSpotifyError(error);
  }
}
