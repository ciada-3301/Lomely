import nodemailer from "nodemailer";

// In-memory store for quick development OTP inspection if SMTP is not configured
export const devOtpStore = new Map<string, { code: string; expiresAt: Date }>();

export function hasEmailProviderConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

export interface MailResult {
  success: boolean;
  error?: string;
}

export async function sendOtpEmail(email: string, code: string): Promise<MailResult> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  devOtpStore.set(email, { code, expiresAt });

  let lastError = "";

  // 1. Resend API support (lightweight REST call)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromAddress =
        process.env.RESEND_FROM ||
        process.env.SMTP_FROM ||
        "Lomely <onboarding@resend.dev>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject: `Your Lomely Verification Code: ${code}`,
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
        }),
      });

      if (res.ok) {
        console.log(`[MAILER] Sent OTP via Resend to ${email}`);
        return { success: true };
      } else {
        const errJson = await res.json().catch(() => null);
        const errText = errJson?.message || (await res.text().catch(() => "Unknown Resend error"));
        console.error("[MAILER] Resend API error response:", errText);

        if (errText.includes("only send testing emails") || errText.includes("verify a domain")) {
          lastError = "Resend Sandbox Restriction: onboarding@resend.dev can only send to your Resend account email. To send to other emails, use Gmail SMTP or verify a custom domain in Resend.";
        } else {
          lastError = `Resend error: ${errText}`;
        }
      }
    } catch (resendError: any) {
      console.error("[MAILER] Resend dispatch exception:", resendError);
      lastError = resendError?.message || "Failed to dispatch email via Resend.";
    }
  }

  // 2. SMTP Transport (Gmail, Brevo, custom SMTP)
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
        from: process.env.SMTP_FROM || `"Lomely" <${smtpUser}>`,
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

      console.log(`[MAILER] Sent OTP via SMTP to ${email}`);
      return { success: true };
    } catch (error: any) {
      console.error("[MAILER] SMTP dispatch error:", error);
      lastError = `SMTP error: ${error?.message || "Failed to dispatch email via SMTP."}`;
    }
  }

  // 3. Fallback dev console output when no mail credentials are configured at all
  if (!resendApiKey && !smtpHost) {
    console.log("\n=======================================================");
    console.log(`[LOMELY DEV EMAIL DISPATCHER]`);
    console.log(`Recipient: ${email}`);
    console.log(`OTP Code : >>> ${code} <<<`);
    console.log(`Expires  : ${expiresAt.toLocaleTimeString()}`);
    console.log("Note: Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS in Vercel to dispatch real emails.");
    console.log("=======================================================\n");
    return { success: true };
  }

  return {
    success: false,
    error: lastError || "Failed to send email. Please check your mail credentials in Vercel settings.",
  };
}
