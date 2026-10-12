import nodemailer from "nodemailer";

// In-memory store for quick development OTP inspection if SMTP is not configured
export const devOtpStore = new Map<string, { code: string; expiresAt: Date }>();

export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  devOtpStore.set(email, { code, expiresAt });

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Lomely" <no-reply@lomely.app>`,
        to: email,
        subject: `Your Lomely Verification Code: ${code}`,
        text: `Your verification code for Lomely is: ${code}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`,
        html: `
          <div style="background-color: #08080a; color: #f4f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; border: 1px solid #1f1f28;">
            <div style="font-size: 20px; font-weight: bold; letter-spacing: -0.5px; margin-bottom: 24px; color: #f59e0b;">LOMELY</div>
            <h2 style="font-size: 18px; margin-bottom: 8px; font-weight: 600;">Verify your email address</h2>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Enter the following 6-digit one-time password to complete your Lomely registration.</p>
            <div style="background-color: #121217; border: 1px solid #2d2d3a; border-radius: 6px; padding: 18px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #f59e0b; margin-bottom: 24px;">
              ${code}
            </div>
            <p style="color: #71717a; font-size: 12px; margin: 0;">This code expires in 10 minutes. Do not share this with anyone.</p>
          </div>
        `,
      });

      console.log(`[MAILER] Sent OTP to ${email}`);
      return true;
    } catch (error) {
      console.error("[MAILER] SMTP dispatch error:", error);
      // Fallback to dev log
    }
  }

  // Development output
  console.log("\n=======================================================");
  console.log(`[LOMELY DEV EMAIL DISPATCHER]`);
  console.log(`Recipient: ${email}`);
  console.log(`OTP Code : >>> ${code} <<<`);
  console.log(`Expires  : ${expiresAt.toLocaleTimeString()}`);
  console.log("=======================================================\n");

  return true;
}
