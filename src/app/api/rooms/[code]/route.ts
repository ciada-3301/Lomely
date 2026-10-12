import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const user = await getCurrentUser();

    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            status: true,
          },
        },
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
        invites: {
          select: {
            invitedUserId: true,
            status: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check private room access
    if (!room.isPublic) {
      if (!user) {
        return NextResponse.json(
          { error: "Authentication required to view this private room" },
          { status: 401 }
        );
      }

      const isHost = room.hostId === user.id;
      const isParticipant = room.participants.some((p) => p.userId === user.id);
      const isInvited = room.invites.some((i) => i.invitedUserId === user.id);

      if (!isHost && !isParticipant && !isInvited && user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "This is a private room. You must be invited by the host to join." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        isPublic: room.isPublic,
        hostId: room.hostId,
        host: room.host,
        currentMediaUrl: room.currentMediaUrl,
        currentMediaTitle: room.currentMediaTitle,
        mediaState: room.mediaState,
        mediaTime: room.mediaTime,
        mediaUpdatedAt: room.mediaUpdatedAt,
        participants: room.participants.map((p) => ({
          id: p.id,
          role: p.role,
          isVoiceActive: p.isVoiceActive,
          isVideoActive: p.isVideoActive,
          isScreenSharing: p.isScreenSharing,
          user: p.user,
        })),
        createdAt: room.createdAt,
      },
      currentUserRole: user
        ? room.hostId === user.id
          ? "HOST"
          : room.participants.find((p) => p.userId === user.id)?.role || "MEMBER"
        : "GUEST",
    });
  } catch (error) {
    console.error("Fetch room detail error:", error);
    return NextResponse.json({ error: "Failed to retrieve room details" }, { status: 500 });
  }
}

export async function PATCH(
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

    if (room.hostId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only the room host can update settings" }, { status: 403 });
    }

    const { name, description, isPublic, currentMediaUrl, currentMediaTitle } = await req.json();

    const updated = await prisma.room.update({
      where: { code },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(isPublic !== undefined ? { isPublic: Boolean(isPublic) } : {}),
        ...(currentMediaUrl !== undefined ? { currentMediaUrl } : {}),
        ...(currentMediaTitle !== undefined ? { currentMediaTitle } : {}),
      },
    });

    return NextResponse.json({ success: true, room: updated });
  } catch (error) {
    console.error("Update room error:", error);
    return NextResponse.json({ error: "Failed to update room" }, { status: 500 });
  }
}

export async function DELETE(
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

    if (room.hostId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only the room host or an admin can delete the room" }, { status: 403 });
    }

    await prisma.room.delete({ where: { code } });
    return NextResponse.json({ success: true, message: "Room closed" });
  } catch (error) {
    console.error("Delete room error:", error);
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}
