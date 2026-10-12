import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function generateRoomCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "lml-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q")?.toLowerCase() || "";

    const rooms = await prisma.room.findMany({
      where: {
        isPublic: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { code: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formattedRooms = rooms.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isPublic: r.isPublic,
      host: r.host,
      participantCount: r.participants.length,
      currentMediaTitle: r.currentMediaTitle,
      mediaState: r.mediaState,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ rooms: formattedRooms });
  } catch (error) {
    console.error("Fetch rooms error:", error);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { name, description, isPublic } = await req.json();

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Room name must be at least 2 characters long" },
        { status: 400 }
      );
    }

    let code = generateRoomCode();
    let collision = await prisma.room.findUnique({ where: { code } });
    while (collision) {
      code = generateRoomCode();
      collision = await prisma.room.findUnique({ where: { code } });
    }

    const room = await prisma.room.create({
      data: {
        code,
        name: name.trim(),
        description: description?.trim() || "",
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        hostId: user.id,
        participants: {
          create: {
            userId: user.id,
            role: "HOST",
          },
        },
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
