import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function GET(request: Request) {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/spotify/callback`;
  const isSecure = redirectUri.startsWith("https://");

  cookieStore.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: "playlist-read-private playlist-read-collaborative"
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
