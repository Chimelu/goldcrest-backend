import crypto from 'crypto';

/** 6-digit numeric OTP */
export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes
