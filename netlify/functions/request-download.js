const { Resend } = require("resend");
const crypto = require("crypto");

function generateToken(email, secret) {
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const data = `${email}:${expires}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  return { token: signature, expires };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const { name, email } = JSON.parse(event.body);

  if (!name || !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Name and email required" }),
    };
  }

  const secret = process.env.DOWNLOAD_SECRET;
  const siteUrl = process.env.SITE_URL;
  const senderEmail = process.env.SENDER_EMAIL;

  const { token, expires } = generateToken(email, secret);
  const verifyUrl = `${siteUrl}/.netlify/functions/verify-download?email=${encodeURIComponent(email)}&expires=${expires}&token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: `Ian @ miniti <${senderEmail}>`,
      to: email,
      subject: "Your miniti Download Link",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <img src="${siteUrl}/images/miniti-icon.png" alt="miniti" width="48" height="48" style="border-radius: 12px; margin-bottom: 24px;" />
          <h2 style="margin-bottom: 8px;">Hey ${name},</h2>
          <p>Thanks for your interest in miniti 💚</p>
          <p>Click below to download:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">Download miniti</a>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours. macOS 14.2+ required.</p>
          <p style="color: #555; font-size: 14px; margin-top: 24px;">miniti is in beta. Let me know what you'd like to see in it by replying to this email.</p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">ianahuja.com/miniti</p>
        </div>
      `,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Email send error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }
};
