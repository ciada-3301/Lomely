import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail, hasEmailProviderConfigured } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "No account found with this email" }, { status: 404 });
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ error: "Account email is already verified" }, { status: 400 });
    }

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
    const hasEmailProvider = hasEmailProviderConfigured();

    return NextResponse.json({
      success: true,
      message: hasEmailProvider
        ? "A fresh verification code has been dispatched."
        : "A fresh verification code has been generated.",
      hasEmailProvider,
      debugOtp: !hasEmailProvider || process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json({ error: "Failed to resend code" }, { status: 500 });
  }
}
