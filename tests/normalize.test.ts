import { describe, expect, it } from "vitest";
import { normalizeAlbumTracks, normalizeTrack } from "@/lib/normalize";

describe("normalizeTrack", () => {
  it("normalizes a single track", () => {
    const normalized = normalizeTrack(
      {
        id: "track123",
        name: "My Song",
        duration_ms: 123456,
        track_number: 4,
        disc_number: 1,
        artists: [{ name: "First Artist" }, { name: "Second Artist" }],
        album: {
          id: "album123",
          name: "My Album"
        },
        external_urls: {
          spotify: "https://open.spotify.com/track/track123"
        }
      },
      "https://open.spotify.com/track/track123"
    );

    expect(normalized).toEqual({
      source_type: "track",
      source_url: "https://open.spotify.com/track/track123",
      source_id: "track123",
      position: 1,
      artist_name: "First Artist, Second Artist",
      track_title: "My Song",
      album_name: "My Album",
      track_number: 4,
      disc_number: 1,
      duration_ms: 123456,
      spotify_track_url: "https://open.spotify.com/track/track123"
    });
  });
});

describe("normalizeAlbumTracks", () => {
  it("normalizes all album tracks", () => {
    const rows = normalizeAlbumTracks(
      {
        id: "album123",
        name: "The Album",
        tracks: {
          items: [
            {
              id: "trackA",
              name: "Intro",
              duration_ms: 1000,
              track_number: 1,
              disc_number: 1,
              artists: [{ name: "Artist A" }],
              external_urls: {
                spotify: "https://open.spotify.com/track/trackA"
              }
            },
            {
              id: "trackB",
              name: "Outro",
              duration_ms: 2000,
              track_number: 2,
              disc_number: 1,
              artists: [{ name: "Artist A" }]
            }
          ]
        }
      },
      "https://open.spotify.com/album/album123"
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.position).toBe(1);
    expect(rows[1]?.track_title).toBe("Outro");
    expect(rows[1]?.spotify_track_url).toBeNull();
  });
});
