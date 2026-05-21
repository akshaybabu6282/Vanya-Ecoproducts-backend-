import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { isMailConfigured, sendMail } from './mailer.js';

/** @type {Map<string, { email: string, lastSentAt: number, otpData: object|null }>} */
const pendingSessions = new Map();

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto
    .createHash('sha256')
    .update(`${otp}:${process.env.JWT_SECRET}`)
    .digest('hex');
}

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return 'your email';
  const visible = local.length <= 2 ? local[0] : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}@${domain}`;
}

export function createPendingSession(email) {
  const pendingToken = jwt.sign(
    { purpose: 'admin_otp_pending', email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  pendingSessions.set(pendingToken, {
    email,
    lastSentAt: 0,
    otpData: null,
  });

  return pendingToken;
}

export function validatePendingToken(pendingToken) {
  try {
    const decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'admin_otp_pending' || !decoded.email) {
      return null;
    }
    let session = pendingSessions.get(pendingToken);
    if (!session) {
      session = { email: decoded.email, lastSentAt: 0, otpData: null };
      pendingSessions.set(pendingToken, session);
    } else if (session.email !== decoded.email) {
      return null;
    }
    return { pendingToken, session, email: decoded.email };
  } catch {
    return null;
  }
}

async function deliverOtpEmail(toEmail, otp) {
  if (!isMailConfigured()) {
    if (process.env.OTP_DEV_CONSOLE === 'true') {
      console.log(`[Admin OTP] (dev) Send to ${toEmail}: ${otp}`);
      return;
    }
    throw new Error(
      'Email service is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD on the server.'
    );
  }

  await sendMail(
    toEmail,
    'Vanya Admin Login OTP',
    `Your admin login OTP is: ${otp}\n\nIt expires in 5 minutes. Do not share this code.`
  );
}

export async function sendOtpEmail(pendingToken) {
  const validated = validatePendingToken(pendingToken);
  if (!validated) {
    return { ok: false, message: 'Session expired. Please login again.' };
  }

  const { session, email } = validated;
  const now = Date.now();

  if (now - session.lastSentAt < RESEND_COOLDOWN_MS) {
    return { ok: false, message: 'Please wait a minute before requesting another OTP.' };
  }

  const otp = generateOtp();
  session.otpData = {
    otpHash: hashOtp(otp),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
  };
  session.lastSentAt = now;

  try {
    await deliverOtpEmail(email, otp);
  } catch (error) {
    console.error('OTP email delivery failed:', error);
    return { ok: false, message: error.message || 'Could not send OTP. Try again.' };
  }

  return { ok: true, message: `OTP sent to ${maskEmail(email)}` };
}

export function verifyOtpCode(pendingToken, otpInput) {
  const validated = validatePendingToken(pendingToken);
  if (!validated) {
    return { ok: false, message: 'Session expired. Please login again.' };
  }

  const { session, pendingToken: token } = validated;
  const otpData = session.otpData;
  if (!otpData) {
    return { ok: false, message: 'Request an OTP first.' };
  }
  if (Date.now() > otpData.expiresAt) {
    return { ok: false, message: 'OTP has expired. Request a new one.' };
  }
  if (otpData.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many attempts. Login again.' };
  }

  otpData.attempts += 1;
  const code = String(otpInput ?? '').trim();
  if (!/^\d{6}$/.test(code) || hashOtp(code) !== otpData.otpHash) {
    return { ok: false, message: 'Invalid OTP.' };
  }

  pendingSessions.delete(token);
  return { ok: true };
}
