import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isHost = room.hostId === user.id;

    // Upsert participant
    await prisma.roomParticipant.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
      update: {
        role: isHost ? "HOST" : "MEMBER",
      },
      create: {
        roomId: room.id,
        userId: user.id,
        role: isHost ? "HOST" : "MEMBER",
      },
    });

    // Fetch refreshed participants
    const participants = await prisma.roomParticipant.findMany({
      where: { roomId: room.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      participants: participants.map((p) => ({
        id: p.id,
        role: p.role,
        isVoiceActive: p.isVoiceActive,
        isVideoActive: p.isVideoActive,
        isScreenSharing: p.isScreenSharing,
        user: p.user,
      })),
    });
  } catch (error) {
    console.error("Room join error:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
