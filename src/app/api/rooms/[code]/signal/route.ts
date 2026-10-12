import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

interface SignalEnvelope {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  signalData: any;
  timestamp: number;
}

// In-memory queue per room for serverless WebRTC signaling fallback
const globalSignalStore = globalThis as unknown as {
  lomelySignals: Map<string, SignalEnvelope[]> | undefined;
};

if (!globalSignalStore.lomelySignals) {
  globalSignalStore.lomelySignals = new Map<string, SignalEnvelope[]>();
}

const signalStore = globalSignalStore.lomelySignals;

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId");
    const activeUserId = user?.id || queryUserId;
    if (!activeUserId) {
      return NextResponse.json({ signals: [] });
    }

    const { code } = params;
    const roomSignals = signalStore.get(code) || [];
    const now = Date.now();

    // Clean up signals older than 30 seconds
    const freshSignals = roomSignals.filter((s) => now - s.timestamp < 30000);

    // Extract signals intended for this user
    const userSignals = freshSignals.filter((s) => s.toUserId === activeUserId);

    // Retain only signals intended for other users
    const remainingSignals = freshSignals.filter((s) => s.toUserId !== activeUserId);
    signalStore.set(code, remainingSignals);

    return NextResponse.json({ signals: userSignals });
  } catch (error) {
    console.error("Signal GET error:", error);
    return NextResponse.json({ signals: [] });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const user = await getCurrentUser();
    const body = await req.json();
    const { toUserId, signalData, fromUserId, fromUsername } = body;
    const activeUserId = user?.id || fromUserId;
    const activeUsername = user?.username || fromUsername || "Roommate";

    if (!activeUserId || !toUserId || !signalData) {
      return NextResponse.json({ error: "Active user, toUserId and signalData are required" }, { status: 400 });
    }

    if (!signalStore.has(code)) {
      signalStore.set(code, []);
    }

    const roomSignals = signalStore.get(code)!;
    roomSignals.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      fromUserId: activeUserId,
      fromUsername: activeUsername,
      toUserId,
      signalData,
      timestamp: Date.now(),
    });

    if (roomSignals.length > 200) {
      roomSignals.splice(0, roomSignals.length - 200);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signal POST error:", error);
    return NextResponse.json({ error: "Failed to dispatch signal" }, { status: 500 });
  }
}
