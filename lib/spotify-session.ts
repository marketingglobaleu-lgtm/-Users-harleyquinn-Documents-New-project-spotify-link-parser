import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { SpotifyUserSession } from "@/lib/types";

const COOKIE_NAME = "spotify_user_session";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEncryptionKey() {
  const secret = getRequiredEnv("SESSION_ENCRYPTION_SECRET");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(payload: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(payload: string) {
  const buffer = Buffer.from(payload, "base64url");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function saveUserSession(session: SpotifyUserSession) {
  const cookieStore = await cookies();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  cookieStore.set(COOKIE_NAME, encrypt(JSON.stringify(session)), {
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function getUserSession(): Promise<SpotifyUserSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    return JSON.parse(decrypt(cookie)) as SpotifyUserSession;
  } catch {
    return null;
  }
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function exchangeSpotifyCodeForSession(
  code: string,
  redirectUriOverride?: string
): Promise<SpotifyUserSession> {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
  const redirectUri =
    redirectUriOverride ?? getRequiredEnv("SPOTIFY_REDIRECT_URI");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Spotify auth code.");
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };
}

export async function refreshSpotifySessionIfNeeded(
  session: SpotifyUserSession
): Promise<SpotifyUserSession> {
  const now = Date.now();
  if (session.expiresAt > now + 60_000) {
    return session;
  }

  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
  const refreshedResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    })
  });

  if (!refreshedResponse.ok) {
    throw new Error("Failed to refresh Spotify access token.");
  }

  const refreshed = (await refreshedResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const nextSession = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000
  };

  await saveUserSession(nextSession);
  return nextSession;
}
