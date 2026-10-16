import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendVerificationOtp(
  email: string,
  name: string,
  otp: string,
) {
  if (!resend || !emailFrom) {
    throw new Error("Email service is not configured");
  }

  const { error } = await resend.emails.send({
    from: emailFrom,
    to: [email],
    subject: "Verify your TaskFlow AI account",
    text: [
      `Hi ${name},`,
      "",
      `Your TaskFlow AI verification code is ${otp}.`,
      "This code expires in 10 minutes.",
      "If you did not request this code, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2>Verify your TaskFlow AI account</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Use this one-time verification code:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;
                    padding:16px;background:#f3f4f6;text-align:center">
          ${otp}
        </div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this code, ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error("Unable to send verification email");
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}