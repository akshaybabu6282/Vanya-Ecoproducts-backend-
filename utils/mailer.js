import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASSWORD,
      },
    });
  }
  return transporter;
}

export function isMailConfigured() {
  return Boolean(process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSWORD?.trim());
}

export async function sendMail(to, subject, text) {
  const info = await getTransporter().sendMail({
    from: process.env.ADMIN_EMAIL,
    to,
    subject,
    text,
  });
  return info;
}
