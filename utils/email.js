import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPasswordResetEmail(toEmail, resetToken) {
  const frontendUrl = process.env.FRONTEND_URL || "https://servicekart.yepkart.com";
  const resetLink = `${frontendUrl}?token=${resetToken}`;

  await transporter.sendMail({
    from: `"Divine Shop" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Reset Your Divine Shop Password",
    html: `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 32px; background: #fff9f2; border-radius: 16px; border: 1px solid #f0e0cc;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #b45309; font-size: 28px; margin: 0;">🕉 Divine Shop</h1>
        </div>
        <h2 style="color: #1a1a1a; font-size: 22px; margin-bottom: 8px;">Reset Your Password</h2>
        <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your Divine Shop account (<strong>${toEmail}</strong>).
          Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background: #b45309; color: #fff; padding: 14px 32px; border-radius: 32px; text-decoration: none; font-weight: bold; font-size: 15px; letter-spacing: 0.05em; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          If you did not request this, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #f0e0cc; margin: 32px 0;" />
        <p style="color: #bbb; font-size: 12px; text-align: center;">
          © Divine Shop — Sacred Products for the Soul
        </p>
      </div>
    `,
  });
}
