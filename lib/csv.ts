import type { NormalizedTrackRow } from "@/lib/types";

const CSV_HEADERS: Array<keyof NormalizedTrackRow> = [
  "source_type",
  "source_url",
  "source_id",
  "position",
  "artist_name",
  "track_title",
  "album_name",
  "track_number",
  "disc_number",
  "duration_ms",
  "spotify_track_url"
];

function escapeCsvCell(value: unknown) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

export function buildCsv(rows: NormalizedTrackRow[]) {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => escapeCsvCell(row[header])).join(","))
  ];

  return `${lines.join("\n")}\n`;
}

export function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
