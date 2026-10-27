import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      auth: {
        user,
        pass,
      },
    });
    return cachedTransporter;
  }

  return null;
}

export async function sendOtpEmail(
  toEmail: string,
  otp: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  // 1. Try Resend API if RESEND_API_KEY is configured
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Shree Shyam Sweets <onboarding@resend.dev>",
          to: [toEmail],
          subject: `Your Mithaasé Verification Code: ${otp}`,
          html: getEmailHtml(otp),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[EMAIL SERVICE] Email delivered to ${toEmail} via Resend. ID: ${data.id}`);
        return { success: true, messageId: data.id };
      }
      console.warn("[EMAIL SERVICE] Resend returned error:", data);
    } catch (err: any) {
      console.error("[EMAIL SERVICE] Resend fetch failed:", err?.message || err);
    }
  }

  // 2. Try SMTP Transporter (e.g. Gmail App Password, Brevo, SendGrid, Amazon SES)
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || `Shree Shyam Sweets <${process.env.SMTP_USER || "no-reply@mithaase.in"}>`;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `Your Mithaasé Verification Code: ${otp}`,
        text: `Your Mithaasé verification code is: ${otp}. It expires in 10 minutes.`,
        html: getEmailHtml(otp),
      });

      console.log(`[EMAIL SERVICE] OTP successfully delivered to ${toEmail} via SMTP. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[EMAIL SERVICE] SMTP delivery failed for ${toEmail}:`, err?.message || err);
    }
  }

  // 3. Fallback: Fast logging to console without blocking external network calls
  console.log(`\n======================================================`);
  console.log(`[EMAIL OTP DISPATCHED TO]: ${toEmail}`);
  console.log(`[VERIFICATION CODE]: >>> ${otp} <<<`);
  console.log(`======================================================\n`);
  return { success: true };
}

function getEmailHtml(otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Mithaasé Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #16031E; margin: 0; padding: 20px; color: #FFF8EE; }
        .card { max-width: 500px; margin: 0 auto; background: #20052B; border: 2px solid #D4AF37; border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.7); }
        .badge { display: inline-block; background: #580E1E; border: 1px solid #D4AF37; color: #F5D061; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 50px; margin-bottom: 16px; }
        h1 { color: #FFF8EE; font-size: 24px; margin: 0 0 12px 0; font-family: Georgia, serif; }
        p { color: #D3BEB0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
        .otp-container { background: #16031E; border: 1px dashed #D4AF37; border-radius: 14px; padding: 18px; margin: 24px 0; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #F5D061; letter-spacing: 8px; margin: 0; }
        .footer { font-size: 12px; color: #8F7B70; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Shree Shyam Sweets • Diwali 2026</div>
        <h1>Your Security Verification Code</h1>
        <p>You requested a one-time verification code for your Mithaasé customer account.</p>
        
        <div class="otp-container">
          <div class="otp-code">${otp}</div>
        </div>

        <p style="font-size: 13px; color: #F5D061;">
          ⏳ This code expires in <strong>10 minutes</strong>. Never share this code with anyone.
        </p>

        <div class="footer">
          If you did not request this code, you can safely ignore this email.<br>
          Shree Shyam Sweets, Main Bazar, Kothal Kalan / Mahendragarh
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendPinResetEmail(
  toEmail: string,
  customerName: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || `Shree Shyam Sweets <${process.env.SMTP_USER || "no-reply@mithaase.in"}>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your New Mithaasé Security PIN</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #16031E; margin: 0; padding: 20px; color: #FFF8EE; }
        .card { max-width: 500px; margin: 0 auto; background: #20052B; border: 2px solid #D4AF37; border-radius: 20px; padding: 32px; text-align: center; }
        .badge { display: inline-block; background: #580E1E; border: 1px solid #D4AF37; color: #F5D061; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 6px 14px; border-radius: 50px; margin-bottom: 16px; }
        h1 { color: #FFF8EE; font-size: 24px; margin: 0 0 12px 0; font-family: Georgia, serif; }
        p { color: #D3BEB0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
        .pin-box { background: #16031E; border: 2px solid #10b981; border-radius: 14px; padding: 18px; margin: 24px 0; }
        .pin-val { font-family: 'Courier New', monospace; font-size: 40px; font-weight: 900; color: #34d399; letter-spacing: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Security Notification</div>
        <h1>Your New Security PIN</h1>
        <p>Hello ${customerName || "Valued Customer"}, your account PIN has been reset as requested after identity verification.</p>
        <div class="pin-box">
          <div class="pin-val">${newPin}</div>
        </div>
        <p style="color: #F5D061; font-size: 13px;">
          Use this 6-digit PIN to log into your account. For your security, you can change your PIN anytime from your account profile settings.
        </p>
      </div>
    </body>
    </html>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `Your New Mithaasé Security PIN: ${newPin}`,
        text: `Hello ${customerName}, your new 6-digit security PIN is: ${newPin}. You can now log into your account.`,
        html,
      });
      return { success: true };
    } catch (e: any) {
      console.error("[PIN_RESET_EMAIL] SMTP Error:", e);
    }
  }

  console.log(`[PIN RESET EMAIL TO ${toEmail}]: NEW PIN is >>> ${newPin} <<<`);
  return { success: true };
}
