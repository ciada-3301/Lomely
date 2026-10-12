import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username or email and password are required" },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanIdentifier }, { email: cleanIdentifier }],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username/email or password" },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid username/email or password" },
        { status: 401 }
      );
    }

    if (!user.isEmailVerified) {
      return NextResponse.json(
        {
          error: "Your email address is not verified yet. Please verify your OTP.",
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      status: user.status,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: safeUser,
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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error during login" },
      { status: 500 }
    );
  }
}
