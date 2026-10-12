import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "Target userId is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, avatarUrl: true, status: true, bio: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mark unread as read
    await prisma.directMessage.updateMany({
      where: {
        senderId: targetUserId,
        receiverId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json({
      targetUser,
      messages,
    });
  } catch (error) {
    console.error("Fetch DM history error:", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { receiverId, content } = await req.json();

    if (!receiverId || !content || !content.trim()) {
      return NextResponse.json({ error: "Receiver ID and message content are required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Recipient user not found" }, { status: 404 });
    }

    const message = await prisma.directMessage.create({
      data: {
        senderId: user.id,
        receiverId,
        content: content.trim(),
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Send DM error:", error);
    return NextResponse.json({ error: "Failed to send direct message" }, { status: 500 });
  }
}
