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
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    const room = await prisma.room.findUnique({
      where: { code },
      include: { invites: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the room host can invite members" },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: `User "@${cleanUsername}" does not exist` },
        { status: 404 }
      );
    }

    if (targetUser.id === user.id) {
      return NextResponse.json(
        { error: "You cannot invite yourself" },
        { status: 400 }
      );
    }

    // Check if already invited or already in room
    const existingInvite = await prisma.roomInvite.findFirst({
      where: {
        roomId: room.id,
        invitedUserId: targetUser.id,
      },
    });

    if (existingInvite) {
      return NextResponse.json({
        message: `@${cleanUsername} is already invited`,
        invite: existingInvite,
      });
    }

    const invite = await prisma.roomInvite.create({
      data: {
        roomId: room.id,
        invitedUserId: targetUser.id,
        invitedBy: user.username,
        status: "PENDING",
      },
    });

    // Also automatically create participant access record for closed room
    await prisma.roomParticipant.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: targetUser.id,
        },
      },
      update: {},
      create: {
        roomId: room.id,
        userId: targetUser.id,
        role: "MEMBER",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invite sent to @${cleanUsername}`,
      invite,
    });
  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json({ error: "Failed to invite user" }, { status: 500 });
  }
}
