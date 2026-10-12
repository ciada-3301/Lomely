import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const room = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const messages = await prisma.roomMessage.findMany({
      where: { roomId: room.id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Fetch room messages error:", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
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
    const { content } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const message = await prisma.roomMessage.create({
      data: {
        roomId: room.id,
        senderId: user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Send room message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
