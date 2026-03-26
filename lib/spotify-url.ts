import { z } from "zod";
import type { ParsedSpotifyInput, SpotifyResourceType } from "@/lib/types";

const supportedResourceTypes = ["track", "album", "artist", "playlist"] as const;
const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/u, "Invalid Spotify resource id.");

export class SpotifyInputError extends Error {}

function validateType(type: string): SpotifyResourceType {
  if (supportedResourceTypes.includes(type as SpotifyResourceType)) {
    return type as SpotifyResourceType;
  }

  throw new Error(`Unsupported Spotify resource type: ${type}`);
}

function cleanInput(input: string) {
  return input.trim();
}

function parseSpotifyUri(input: string): ParsedSpotifyInput | null {
  const match = input.match(/^spotify:(track|album|artist|playlist):([A-Za-z0-9]{22})$/u);
  if (!match) return null;

  const resourceType = validateType(match[1]);
  const id = spotifyIdSchema.parse(match[2]);

  return {
    resourceType,
    id,
    canonicalUrl: `https://open.spotify.com/${resourceType}/${id}`
  };
}

function parseSpotifyUrl(input: string): ParsedSpotifyInput | null {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!["open.spotify.com", "play.spotify.com"].includes(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const normalizedParts =
    parts[0]?.startsWith("intl-") && parts.length > 1 ? parts.slice(1) : parts;

  if (
    normalizedParts.length >= 4 &&
    normalizedParts[0] === "user" &&
    normalizedParts[2] === "playlist"
  ) {
    const id = spotifyIdSchema.parse(normalizedParts[3]);
    return {
      resourceType: "playlist",
      id,
      canonicalUrl: `https://open.spotify.com/playlist/${id}`
    };
  }

  if (normalizedParts.length < 2) return null;

  const resourceType = validateType(normalizedParts[0]);
  const id = spotifyIdSchema.parse(normalizedParts[1]);

  return {
    resourceType,
    id,
    canonicalUrl: `https://open.spotify.com/${resourceType}/${id}`
  };
}

export function parseSpotifyInput(input: string): ParsedSpotifyInput {
  const cleaned = cleanInput(input);
  const parsed = parseSpotifyUri(cleaned) ?? parseSpotifyUrl(cleaned);

  if (!parsed) {
    throw new SpotifyInputError("Input must be a valid Spotify URL or spotify: URI.");
  }

  return parsed;
}
