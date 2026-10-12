import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const room = await prisma.room.findUnique({
      where: { code },
      select: {
        id: true,
        hostId: true,
        isPublic: true,
        currentMediaUrl: true,
        currentMediaTitle: true,
        mediaState: true,
        mediaTime: true,
        mediaUpdatedAt: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({
      media: {
        state: room.mediaState,
        currentTime: room.mediaTime,
        updatedAt: room.mediaUpdatedAt.getTime(),
        url: room.currentMediaUrl,
        title: room.currentMediaTitle,
        hostId: room.hostId,
        isPublic: room.isPublic,
      },
    });
  } catch (error) {
    console.error("Media state fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch media state" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = params;
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isHost = room.hostId === user.id;

    // In private rooms, ONLY the host can control playback
    if (!room.isPublic && !isHost && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the host can control media in a private room" },
        { status: 403 }
      );
    }

    const { mediaState, mediaTime, currentMediaUrl, currentMediaTitle } = await req.json();

    const updated = await prisma.room.update({
      where: { code },
      data: {
        ...(mediaState ? { mediaState } : {}),
        ...(mediaTime !== undefined ? { mediaTime: Number(mediaTime) } : {}),
        ...(currentMediaUrl !== undefined ? { currentMediaUrl } : {}),
        ...(currentMediaTitle !== undefined ? { currentMediaTitle } : {}),
        mediaUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      media: {
        state: updated.mediaState,
        currentTime: updated.mediaTime,
        updatedAt: updated.mediaUpdatedAt.getTime(),
        url: updated.currentMediaUrl,
        title: updated.currentMediaTitle,
      },
    });
  } catch (error) {
    console.error("Media sync error:", error);
    return NextResponse.json({ error: "Failed to sync media" }, { status: 500 });
  }
}
