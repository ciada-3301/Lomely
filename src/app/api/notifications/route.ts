import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ invites: [] });
    }

    const invites = await prisma.roomInvite.findMany({
      where: {
        invitedUserId: user.id,
        status: "PENDING",
      },
      include: {
        room: {
          select: {
            id: true,
            code: true,
            name: true,
            isPublic: true,
            host: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ invites: [] });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteId, action } = await req.json();
    if (!inviteId || !action) {
      return NextResponse.json({ error: "inviteId and action are required" }, { status: 400 });
    }

    const invite = await prisma.roomInvite.findUnique({
      where: { id: inviteId },
      include: { room: true },
    });

    if (!invite || invite.invitedUserId !== user.id) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (action === "ACCEPT") {
      await prisma.roomInvite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" },
      });

      await prisma.roomParticipant.upsert({
        where: {
          roomId_userId: {
            roomId: invite.roomId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          roomId: invite.roomId,
          userId: user.id,
          role: "MEMBER",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Invite accepted",
        roomCode: invite.room.code,
      });
    }

    if (action === "DECLINE") {
      await prisma.roomInvite.update({
        where: { id: inviteId },
        data: { status: "DECLINED" },
      });

      return NextResponse.json({ success: true, message: "Invite declined" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Handle invite action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
