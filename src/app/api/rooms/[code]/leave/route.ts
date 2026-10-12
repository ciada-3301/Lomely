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
      return NextResponse.json({ success: true });
    }

    const { code } = params;
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      return NextResponse.json({ success: true });
    }

    // Don't delete host participant record, but non-hosts can be removed
    if (room.hostId !== user.id) {
      await prisma.roomParticipant.deleteMany({
        where: {
          roomId: room.id,
          userId: user.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Room leave error:", error);
    return NextResponse.json({ success: true });
  }
}
