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

function usesResend() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function usesSmtp() {
  return Boolean(process.env.EMAIL_USER?.trim() && process.env.EMAIL_PASS?.trim());
}

export function isMailConfigured() {
  return usesResend() || usesSmtp();
}

function getFromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    (process.env.EMAIL_USER
      ? `Vanya Ecoproducts <${process.env.EMAIL_USER}>`
      : 'Vanya Ecoproducts <onboarding@resend.dev>')
  );
}

async function sendViaResend(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY.trim();
  console.log("resend called---", apiKey, to, subject, text);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'support@vanyaecoproducts.in',
      to: [to],
      subject,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      data?.message || data?.error?.message || `Resend API error (${response.status})`;
    throw new Error(detail);
  }
  return { response: data?.id || 'sent', provider: 'resend' };
}

async function sendViaSmtp(to, subject, text) {
  const info = await getTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
  return info;
}

export async function sendMail(to, subject, text) {
  try {
    if (usesResend()) {
      return await sendViaResend(to, subject, text);
    }
    if (usesSmtp()) {
      return await sendViaSmtp(to, subject, text);
    }
    throw new Error(
      'Email is not configured. On hosted servers set RESEND_API_KEY. Locally use EMAIL_USER + EMAIL_PASS or OTP_DEV_CONSOLE=true.'
    );
  } catch (error) {
    const msg = error?.message || 'Failed to send email';
    if (/timeout/i.test(msg)) {
      throw new Error(
        'Gmail SMTP is blocked on this host (connection timeout). Use RESEND_API_KEY on Render — SMTP will not work there.'
      );
    }
    if (/invalid login|username and password|535|534/i.test(msg)) {
      throw new Error(
        'Gmail rejected login. EMAIL_PASS must be a Gmail App Password (not ADMIN_PASSWORD).'
      );
    }
    throw error;
  }
}
