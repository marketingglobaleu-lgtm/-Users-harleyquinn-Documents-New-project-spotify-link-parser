import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeSpotifyCodeForSession, saveUserSession } from "@/lib/spotify-session";
import { logEvent } from "@/lib/logger";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_oauth_state")?.value;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/?spotifyAuthError=${encodeURIComponent(error)}`);
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/?spotifyAuthError=invalid_state`);
  }

  try {
    const session = await exchangeSpotifyCodeForSession(code);
    await saveUserSession(session);
    cookieStore.delete("spotify_oauth_state");
    logEvent("spotify_connected", {});
    return NextResponse.redirect(`${appUrl}/?spotifyConnected=1`);
  } catch {
    return NextResponse.redirect(`${appUrl}/?spotifyAuthError=token_exchange_failed`);
  }
}
