import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password, email } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const cleanEmail =
      email && typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : `${cleanUsername}@lomely.app`;

    // Check if username already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { email: cleanEmail }],
      },
    });

    if (existing) {
      if (existing.username === cleanUsername) {
        return NextResponse.json(
          { error: "This username is already taken. Please pick another one." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
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
        isEmailVerified: true,
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
      message: "Account created successfully!",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
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
