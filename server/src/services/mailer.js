import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'https://restrovico.vercel.app';

function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
  }
  return null;
}

export async function sendVerificationEmail({ email, name, token }) {
  const verifyLink = `${APP_URL}/verify-email?token=${token}`;
  const mailOptions = {
    from: process.env.SMTP_FROM || '"RestroVico" <noreply@restrovico.in>',
    to: email,
    subject: 'Verify your RestroVico owner account',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #001B4E;">Welcome to RestroVico, ${name}!</h2>
        <p>Thank you for creating your owner account. Please verify your email address to activate your workspace.</p>
        <div style="margin: 24px 0;">
          <a href="${verifyLink}" style="background-color: #0050EA; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link is valid for 30 minutes. If you did not create a RestroVico account, you can safely ignore this message.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">RestroVico Multi-Outlet Restaurant Management & Control</p>
      </div>
    `
  };

  console.log(`\n================ EMAIL VERIFICATION LINK ================`);
  console.log(`To: ${email}`);
  console.log(`Link: ${verifyLink}`);
  console.log(`=========================================================\n`);

  let previewUrl = null;
  try {
    const transporter = getTransporter();
    if (transporter) {
      const info = await transporter.sendMail(mailOptions);
      previewUrl = nodemailer.getTestMessageUrl(info) || null;
      if (previewUrl) {
        console.log(`[Mailer] View verification email online: ${previewUrl}`);
      }
    }
  } catch (err) {
    console.error('[Mailer] Email sending error:', err.message);
  }
  return { verifyLink, previewUrl };
}

export async function sendPasswordResetEmail({ email, name, token }) {
  const resetLink = `${APP_URL}/reset-password?token=${token}`;
  const mailOptions = {
    from: process.env.SMTP_FROM || '"RestroVico" <noreply@restrovico.in>',
    to: email,
    subject: 'Reset your RestroVico password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #001B4E;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your RestroVico password. Click the button below to set a new password:</p>
        <div style="margin: 24px 0;">
          <a href="${resetLink}" style="background-color: #0050EA; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">This reset link expires in 30 minutes. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">RestroVico Multi-Outlet Restaurant Management & Control</p>
      </div>
    `
  };

  console.log(`\n================ PASSWORD RESET LINK ================`);
  console.log(`To: ${email}`);
  console.log(`Link: ${resetLink}`);
  console.log(`=====================================================\n`);

  let previewUrl = null;
  try {
    const transporter = getTransporter();
    if (transporter) {
      const info = await transporter.sendMail(mailOptions);
      previewUrl = nodemailer.getTestMessageUrl(info) || null;
      if (previewUrl) {
        console.log(`[Mailer] View reset email online: ${previewUrl}`);
      }
    }
  } catch (err) {
    console.error('[Mailer] Password reset email error:', err.message);
  }
  return { resetLink, previewUrl };
}
