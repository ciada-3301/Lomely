import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q")?.toLowerCase() || "";

    // If query search provided, search all users
    if (search) {
      const users = await prisma.user.findMany({
        where: {
          username: { contains: search },
          id: { not: user.id },
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          status: true,
        },
        take: 20,
      });
      return NextResponse.json({ users });
    }

    // Otherwise return list of recent conversations
    const dms = await prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true, status: true },
        },
        receiver: {
          select: { id: true, username: true, avatarUrl: true, status: true },
        },
      },
      take: 100,
    });

    const conversationMap = new Map<string, {
      user: { id: string; username: string; avatarUrl: string | null; status: string };
      lastMessage: string;
      lastMessageAt: Date;
      unreadCount: number;
    }>();

    for (const msg of dms) {
      const partner = msg.senderId === user.id ? msg.receiver : msg.sender;
      if (!conversationMap.has(partner.id)) {
        conversationMap.set(partner.id, {
          user: partner,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: (!msg.isRead && msg.receiverId === user.id) ? 1 : 0,
        });
      } else {
        const item = conversationMap.get(partner.id)!;
        if (!msg.isRead && msg.receiverId === user.id) {
          item.unreadCount += 1;
        }
      }
    }

    const conversations = Array.from(conversationMap.values());
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Fetch messaging users error:", error);
    return NextResponse.json({ error: "Failed to load direct messages" }, { status: 500 });
  }
}
