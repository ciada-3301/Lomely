import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUDIUS_DISCOVERY_NODES = [
  "https://discoveryprovider.audius.co",
  "https://audius-dp.singapore.creatornodes.com",
  "https://discoveryprovider2.audius.co",
  "https://dn1.monophonic.digital",
];

// Helper to query Audius with automatic node fallback
async function fetchAudius(endpoint: string) {
  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const url = `${node}/v1${endpoint}&app_name=lomely`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch {
      // Try next node on network timeout
    }
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "trending";
    const query = searchParams.get("q") || "";
    const genre = searchParams.get("genre") || "";
    const limit = searchParams.get("limit") || "15";

    let endpoint = "";

    if (action === "search" && query.trim()) {
      endpoint = `/tracks/search?query=${encodeURIComponent(query.trim())}&limit=${limit}`;
    } else {
      // Trending tracks
      endpoint = `/tracks/trending?limit=${limit}`;
      if (genre) {
        endpoint += `&genre=${encodeURIComponent(genre)}`;
      }
    }

    const tracks = await fetchAudius(endpoint);

    // Format tracks into a clean, unified Lomely track object
    const formatted = tracks.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.user?.name || t.user?.handle || "Unknown Artist",
      artistHandle: t.user?.handle,
      duration: t.duration || 0,
      genre: t.genre || "Music",
      mood: t.mood || null,
      artworkUrl:
        t.artwork?.["480x480"] ||
        t.artwork?.["150x150"] ||
        t.artwork?.["1000x1000"] ||
        null,
      // Route through Lomely buffered audio proxy with Range & Content-Length support
      streamUrl: `/api/music/audius/stream?id=${t.id}`,
    }));

    return NextResponse.json({ tracks: formatted });
  } catch (error: any) {
    console.error("Audius API error:", error);
    return NextResponse.json({ error: "Failed to fetch music", tracks: [] }, { status: 500 });
  }
}
