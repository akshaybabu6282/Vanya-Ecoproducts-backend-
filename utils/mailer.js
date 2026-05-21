import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    });
  }
  return transporter;
}

export function isMailConfigured() {
  return Boolean(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS?.trim());
}

export async function sendMail(to, subject, text) {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    return info;
  } catch (error) {
    const msg = error?.message || 'Failed to send email';
    if (/timeout/i.test(msg)) {
      throw new Error(
        'Could not reach Gmail SMTP (connection timeout). Use EMAIL_USER + Gmail App Password in .env, or set OTP_DEV_CONSOLE=true for local testing.'
      );
    }
    if (/invalid login|username and password|535|534/i.test(msg)) {
      throw new Error(
        'Gmail rejected login. Use a Gmail App Password in EMAIL_PASS (not ADMIN_PASSWORD). See https://myaccount.google.com/apppasswords'
      );
    }
    throw error;
  }
}
