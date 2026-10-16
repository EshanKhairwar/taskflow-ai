
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim();

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendVerificationOtp(
  email: string,
  name: string,
  otp: string,
): Promise<void> {
  // Validate email service configuration.
  if (!apiKey || !resend || !emailFrom) {
    console.error("Email service configuration error:", {
      hasApiKey: Boolean(apiKey),
      hasEmailFrom: Boolean(emailFrom),
    });

    throw new Error("Email service is not configured");
  }

  try {
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: "Verify your TaskFlow AI account",
      text: [
        `Hi ${name},`,
        "",
        "Welcome to TaskFlow AI!",
        "",
        `Your verification code is: ${otp}`,
        "",
        "This code expires in 10 minutes.",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
            <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
              <h2 style="margin-top:0">Verify your TaskFlow AI account</h2>

              <p>Hi ${escapeHtml(name)},</p>

              <p>Use the verification code below to verify your email address:</p>

              <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px 12px;background:#f1f5f9;border-radius:8px;text-align:center">
                ${escapeHtml(otp)}
              </div>

              <p>This code expires in <strong>10 minutes</strong>.</p>

              <p style="font-size:13px;color:#64748b">
                If you did not request this code, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      // Log provider details for diagnosis. Never log the API key or OTP.
      console.error("Resend email error:", {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
      });

      throw new Error("Unable to send verification email");
    }

    console.info("Verification email accepted by Resend:", {
      email,
      emailId: data?.id ?? "unknown",
    });
  } catch (error) {
    console.error(
      "Verification email service failed:",
      error instanceof Error ? error.message : "Unknown email service error",
    );

    throw error instanceof Error &&
      error.message === "Unable to send verification email"
      ? error
      : new Error("Unable to send verification email");
  }
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}
