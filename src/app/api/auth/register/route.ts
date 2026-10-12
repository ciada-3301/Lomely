import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      return NextResponse.json(
        { error: "Username must be between 3 and 24 characters" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: "Username can only contain alphanumeric characters and underscores" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { email: cleanEmail }],
      },
    });

    if (existing) {
      if (existing.username === cleanUsername) {
        return NextResponse.json(
          { error: "This username is already taken" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "ADMIN" : "USER";

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        role,
        isEmailVerified: false,
      },
    });

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.create({
      data: {
        email: cleanEmail,
        code: otpCode,
        expiresAt,
      },
    });

    await sendOtpEmail(cleanEmail, otpCode);

    return NextResponse.json({
      success: true,
      message: "Account created. Verification OTP sent to email.",
      email: cleanEmail,
      // For instant local development DX, provide debugOtp if not in production
      debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error during registration" },
      { status: 500 }
    );
  }
}
