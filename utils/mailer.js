import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASSWORD,
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
  console.log("resend called---")
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'p.kombra@gmail.com',
      to: ['priyankaprakash5794@gmail.com'],
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
  console.log("smtp called---", process.env.ADMIN_EMAIL, to, subject, text);
  const info = await getTransporter().sendMail({
    from: process.env.ADMIN_EMAIL,
    to,
    subject,
    text,
  });
  return info;
}

export async function sendMail(to, subject, text) {
  try {
    // if (usesResend()) {
    //   return await sendViaResend(to, subject, text);
    // }
    if (usesSmtp()) {
      return await sendViaSmtp(to, subject, text);
    }
    throw new Error(
      'Email is not configured. On hosted servers set RESEND_API_KEY (recommended). Locally use EMAIL_USER + EMAIL_PASS or OTP_DEV_CONSOLE=true.'
    );
  } catch (error) {
    console.log("error---", error);
    const msg = error?.message || 'Failed to send email';
    if (/timeout/i.test(msg)) {
      throw new Error(
        'Gmail SMTP is blocked on this host (connection timeout). Add RESEND_API_KEY to your server environment variables — see https://resend.com — then redeploy.'
      );
    }
    if (/invalid login|username and password|535|534/i.test(msg)) {
      throw new Error(
        'Gmail rejected login. Use a Gmail App Password in EMAIL_PASS, or use RESEND_API_KEY on production.'
      );
    }
    throw error;
  }
}
