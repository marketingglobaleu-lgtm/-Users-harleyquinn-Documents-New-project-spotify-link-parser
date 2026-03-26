import { describe, expect, it } from "vitest";
import { parseSpotifyInput } from "@/lib/spotify-url";

describe("parseSpotifyInput", () => {
  it("parses track URLs", () => {
    const parsed = parseSpotifyInput(
      "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl?si=123"
    );

    expect(parsed).toEqual({
      resourceType: "track",
      id: "11dFghVXANMlKmJXsNCbNl",
      canonicalUrl: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl"
    });
  });

  it("parses spotify URIs", () => {
    const parsed = parseSpotifyInput("spotify:album:4aawyAB9vmqN3uQ7FjRGTy");

    expect(parsed.resourceType).toBe("album");
    expect(parsed.id).toBe("4aawyAB9vmqN3uQ7FjRGTy");
  });

  it("parses intl Spotify URLs", () => {
    const parsed = parseSpotifyInput(
      "https://open.spotify.com/intl-de/artist/66CXWjxzNUsdJxJ2JdwvnR"
    );

    expect(parsed.resourceType).toBe("artist");
    expect(parsed.id).toBe("66CXWjxzNUsdJxJ2JdwvnR");
  });

  it("parses legacy user playlist URLs", () => {
    const parsed = parseSpotifyInput(
      "https://open.spotify.com/user/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M"
    );

    expect(parsed.resourceType).toBe("playlist");
    expect(parsed.id).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("throws for unsupported input", () => {
    expect(() => parseSpotifyInput("https://example.com/track/abc")).toThrow(
      "Input must be a valid Spotify URL or spotify: URI."
    );
  });
});
