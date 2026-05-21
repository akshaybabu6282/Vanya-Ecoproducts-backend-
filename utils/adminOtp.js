import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function normalizeIndianMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function last4Of(number) {
  const digits = normalizeIndianMobile(number);
  return digits.length >= 4 ? digits.slice(-4) : digits;
}

function phoneEntry(id, rawNumber) {
  const number = normalizeIndianMobile(rawNumber);
  return { id, number, last4: last4Of(number) };
}

export const ADMIN_OTP_PHONES = [
  phoneEntry('phone_1', process.env.ADMIN_OTP_PHONE_1 || '9400890544'),
  phoneEntry('phone_2', process.env.ADMIN_OTP_PHONE_2 || '8281663437'),
];

/** @type {Map<string, { email: string, sendCount: Record<string, number>, otpData: object|null }>} */
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

export function getPhoneOptionsForClient() {
  return ADMIN_OTP_PHONES.map(({ id, last4 }) => ({ id, last4 }));
}

export function getPhoneById(phoneId) {
  return ADMIN_OTP_PHONES.find((p) => p.id === phoneId) ?? null;
}

export function createPendingSession(email) {
  const pendingToken = jwt.sign(
    { purpose: 'admin_otp_pending', email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  pendingSessions.set(pendingToken, {
    email,
    sendCount: {},
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
      session = { email: decoded.email, sendCount: {}, otpData: null };
      pendingSessions.set(pendingToken, session);
    } else if (session.email !== decoded.email) {
      return null;
    }
    return { pendingToken, session, email: decoded.email };
  } catch {
    return null;
  }
}

function fast2smsErrorMessage(data) {
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'Failed to send SMS';
}

async function deliverViaOtpApi(apiKey, mobile, otp) {
  const otpId = process.env.FAST2SMS_OTP_ID?.trim();
  if (!otpId) return false;

  const response = await fetch('https://www.fast2sms.com/dev/otp/send', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile,
      otp_id: otpId,
      otp,
      otp_length: 6,
      otp_expiry: 5,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.return !== true) {
    throw new Error(fast2smsErrorMessage(data));
  }
  return true;
}

async function deliverViaBulkOtpRoute(apiKey, mobile, otp) {
  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'otp',
      variables_values: otp,
      numbers: mobile,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.return !== true) {
    throw new Error(fast2smsErrorMessage(data));
  }
}

async function deliverOtpSms(number, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  const mobile = normalizeIndianMobile(number);

  if (!/^\d{10}$/.test(mobile)) {
    throw new Error('Invalid admin phone number configured on server.');
  }

  if (!apiKey) {
    if (process.env.OTP_DEV_CONSOLE === 'true') {
      console.log(`[Admin OTP] (dev) Send to ${mobile}: ${otp}`);
      return;
    }
    throw new Error(
      'SMS service is not configured. Set FAST2SMS_API_KEY on the server.'
    );
  }

  if (process.env.FAST2SMS_OTP_ID?.trim()) {
    try {
      const sent = await deliverViaOtpApi(apiKey, mobile, otp);
      if (sent) return;
    } catch (err) {
      console.warn('[Admin OTP] OTP API failed, trying bulkV2:', err.message);
    }
  }

  await deliverViaBulkOtpRoute(apiKey, mobile, otp);
}

export async function sendOtpToPhone(pendingToken, phoneId) {
  const validated = validatePendingToken(pendingToken);
  if (!validated) {
    return { ok: false, message: 'Session expired. Please login again.' };
  }

  const phone = getPhoneById(phoneId);
  if (!phone) {
    return { ok: false, message: 'Invalid phone selection.' };
  }
  if (!/^\d{10}$/.test(phone.number)) {
    return { ok: false, message: 'Admin phone number is not configured correctly.' };
  }

  const { session } = validated;
  const now = Date.now();
  const lastSend = session.sendCount[phoneId] || 0;
  if (now - lastSend < RESEND_COOLDOWN_MS) {
    return { ok: false, message: 'Please wait a minute before requesting another OTP.' };
  }

  const otp = generateOtp();
  session.otpData = {
    phoneId,
    otpHash: hashOtp(otp),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
  };
  session.sendCount[phoneId] = now;

  try {
    await deliverOtpSms(phone.number, otp);
  } catch (error) {
    console.error('OTP SMS delivery failed:', error);
    return { ok: false, message: error.message || 'Could not send OTP. Try again.' };
  }

  return { ok: true, message: `OTP sent to number ending in ${phone.last4}` };
}

export function verifyOtpCode(pendingToken, phoneId, otpInput) {
  const validated = validatePendingToken(pendingToken);
  if (!validated) {
    return { ok: false, message: 'Session expired. Please login again.' };
  }

  const { session } = validated;
  const otpData = session.otpData;
  if (!otpData) {
    return { ok: false, message: 'Request an OTP first.' };
  }
  if (otpData.phoneId !== phoneId) {
    return { ok: false, message: 'Selected number does not match the OTP request.' };
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

  pendingSessions.delete(pendingToken);
  return { ok: true };
}
