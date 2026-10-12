import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CachedAudio {
  buffer: Buffer;
  contentType: string;
  size: number;
  timestamp: number;
}

// In-memory cache for stream audio buffers (max 25 tracks ~ 200MB)
const audioBufferCache = new Map<string, CachedAudio>();
const MAX_CACHE_ENTRIES = 25;

const AUDIUS_DISCOVERY_NODES = [
  "https://discoveryprovider.audius.co",
  "https://audius-dp.singapore.creatornodes.com",
  "https://discoveryprovider2.audius.co",
  "https://dn1.monophonic.digital",
];

async function fetchAudioBufferFromAudius(trackId: string): Promise<Buffer | null> {
  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const streamUrl = `${node}/v1/tracks/${trackId}/stream?app_name=lomely`;
      const res = await fetch(streamUrl, {
        redirect: "follow",
        headers: {
          Accept: "audio/mpeg, audio/*; q=0.9, */*; q=0.8",
          "User-Agent": "Lomely/1.0",
        },
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
          return Buffer.from(arrayBuf);
        }
      }
    } catch (err) {
      console.warn(`[Audius Stream] Node ${node} failed for track ${trackId}, trying next...`);
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get("id");
    const rawUrl = searchParams.get("url");

    if (!trackId && !rawUrl) {
      return NextResponse.json({ error: "Missing track ID or stream URL" }, { status: 400 });
    }

    const cacheKey = trackId || rawUrl!;
    let cached = audioBufferCache.get(cacheKey);

    if (!cached) {
      let buffer: Buffer | null = null;

      if (trackId) {
        buffer = await fetchAudioBufferFromAudius(trackId);
      } else if (rawUrl) {
        const res = await fetch(rawUrl, {
          redirect: "follow",
          headers: { "User-Agent": "Lomely/1.0" },
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          buffer = Buffer.from(ab);
        }
      }

      if (!buffer || buffer.length === 0) {
        return NextResponse.json(
          { error: "Could not retrieve audio stream from Audius nodes" },
          { status: 502 }
        );
      }

      // Evict oldest entry if cache limit reached
      if (audioBufferCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = audioBufferCache.keys().next().value;
        if (oldestKey) audioBufferCache.delete(oldestKey);
      }

      cached = {
        buffer,
        contentType: "audio/mpeg",
        size: buffer.length,
        timestamp: Date.now(),
      };

      audioBufferCache.set(cacheKey, cached);
    }

    const totalSize = cached.size;
    const rangeHeader = req.headers.get("range");

    // Handle HTTP Range requests for seamless seeking
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunksize = end - start + 1;

      const chunkBuffer = cached.buffer.subarray(start, end + 1);

      return new Response(new Uint8Array(chunkBuffer), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=86400, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Full audio file response with exact Content-Length
    return new Response(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        "Content-Length": totalSize.toString(),
        "Content-Type": cached.contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("[Audius Stream Error]", error);
    return NextResponse.json({ error: "Failed to stream audio buffer" }, { status: 500 });
  }
}
