import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // Mark OTP used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Mark user verified
    const user = await prisma.user.update({
      where: { email: cleanEmail },
      data: { isEmailVerified: true },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isEmailVerified: true,
        status: true,
        avatarUrl: true,
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Email verified successfully",
      user,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Internal server error during verification" },
      { status: 500 }
    );
  }
}
