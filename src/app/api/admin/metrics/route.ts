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

    const [totalUsers, verifiedUsers, totalRooms, publicRooms, roomMessages, directMessages] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isEmailVerified: true } }),
        prisma.room.count(),
        prisma.room.count({ where: { isPublic: true } }),
        prisma.roomMessage.count(),
        prisma.directMessage.count(),
      ]);

    return NextResponse.json({
      metrics: {
        totalUsers,
        verifiedUsers,
        totalRooms,
        publicRooms,
        totalMessages: roomMessages + directMessages,
        roomMessages,
        directMessages,
      },
    });
  } catch (error) {
    console.error("Admin metrics error:", error);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
