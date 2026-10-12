import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const rooms = await prisma.room.findMany({
      include: {
        host: {
          select: { id: true, username: true, email: true },
        },
        _count: {
          select: { participants: true, messages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("Admin rooms list error:", error);
    return NextResponse.json({ error: "Failed to load rooms" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("id");

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    return NextResponse.json({ success: true, message: "Room terminated" });
  } catch (error) {
    console.error("Admin delete room error:", error);
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}
