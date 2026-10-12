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

    // 1. Purge stale unverified registration attempts older than 24h
    try {
      await prisma.user.deleteMany({
        where: {
          isEmailVerified: false,
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
    } catch (cleanupErr) {
      // Non-fatal cleanup
    }

    // 2. Check existing records by email and username
    const existingByEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    const existingByUsername = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    const passwordHash = await hashPassword(password);
    let user;

    if (existingByEmail) {
      // If the account is already verified, block re-registration and ask to login
      if (existingByEmail.isEmailVerified) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      // If an unverified user is restarting registration:
      if (existingByUsername && existingByUsername.id !== existingByEmail.id) {
        if (existingByUsername.isEmailVerified) {
          return NextResponse.json(
            { error: "This username is already taken by a registered user. Please choose another username." },
            { status: 409 }
          );
        } else {
          // Abandoned unverified user with this username; release the username
          await prisma.user.delete({ where: { id: existingByUsername.id } });
        }
      }

      // Update existing unverified record with latest username and password
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          username: cleanUsername,
          passwordHash,
        },
      });
    } else {
      // New email: check if username is claimed
      if (existingByUsername) {
        if (existingByUsername.isEmailVerified) {
          return NextResponse.json(
            { error: "This username is already taken. Please choose another username." },
            { status: 409 }
          );
        } else {
          // Abandoned unverified user with another email; release the username
          await prisma.user.delete({ where: { id: existingByUsername.id } });
        }
      }

      const verifiedUsersCount = await prisma.user.count({ where: { isEmailVerified: true } });
      const role = verifiedUsersCount === 0 ? "ADMIN" : "USER";

      user = await prisma.user.create({
        data: {
          username: cleanUsername,
          email: cleanEmail,
          passwordHash,
          role,
          isEmailVerified: false,
        },
      });
    }

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

    const mailResult = await sendOtpEmail(cleanEmail, otpCode);
    if (!mailResult.success && mailResult.error) {
      return NextResponse.json(
        { error: mailResult.error },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account created. Verification OTP sent to your email.",
      email: cleanEmail,
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    let errorMessage = "Internal server error during registration";
    if (error?.message) {
      if (error.message.includes("does not exist") || error.message.includes("relation")) {
        errorMessage = "Database tables are not migrated yet. Ensure DATABASE_URL is set and redeploy on Vercel.";
      } else if (
        error.message.includes("connect") ||
        error.message.includes("P1001") ||
        error.message.includes("P1000") ||
        error.message.includes("reach database")
      ) {
        errorMessage = "Cannot connect to database. Please check DATABASE_URL in Vercel project settings.";
      } else if (error.message.includes("EROFS") || error.message.includes("read-only")) {
        errorMessage = "SQLite cannot run on Vercel serverless. Please add a PostgreSQL database in Vercel Storage settings.";
      }
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
