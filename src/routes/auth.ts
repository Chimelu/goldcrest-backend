import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendPasswordResetOtp, sendVerificationOtp } from '../services/mail';
import { generateOtp, OTP_TTL_MS } from '../utils/otp';

const router = Router();

async function assignOtpAndEmail(user: InstanceType<typeof User>, email: string) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpHash = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();
  await sendVerificationOtp(email, otp);
}

async function assignPasswordResetOtp(user: InstanceType<typeof User>, email: string) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpHash = otpHash;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();
  await sendPasswordResetOtp(email, otp);
}

const GENERIC_RESET_MESSAGE =
  'If an account exists for this email, you will receive a reset code shortly.';

router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  let created: InstanceType<typeof User> | undefined;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    created = await User.create({
      email,
      passwordHash,
      fullName,
      isVerified: false,
      canTransact: false,
      otpHash: null,
      otpExpiresAt: null,
    });

    await assignOtpAndEmail(created, email);

    return res.status(201).json({
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      isVerified: false,
      message: 'Verification code sent to your email.',
    });
  } catch (err) {
    if (created?.id) {
      await User.destroy({ where: { id: created.id } }).catch(() => undefined);
    }
    console.error('Register / mail error:', err);
    const msg = err instanceof Error ? err.message : 'Registration failed';
    if (msg.includes('Mail is not configured') || msg.includes('ZOHO_EMAIL')) {
      return res.status(503).json({
        message:
          'Email service is not configured on the server. Ask the admin to set ZOHO_EMAIL and ZOHO_PASSWORD.',
      });
    }
    return res.status(500).json({
      message: 'Could not send verification email. Try again later or contact support.',
    });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and verification code are required' });
  }

  const code = String(otp).replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) {
    return res.status(400).json({ message: 'Enter the 6-digit code from your email' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(404).json({ message: 'No account found for this email' });
  }

  if (user.isVerified) {
    return res.status(200).json({
      message: 'Email already verified',
      isVerified: true,
      email: user.email,
    });
  }

  if (!user.otpHash || !user.otpExpiresAt) {
    return res.status(400).json({ message: 'No active code. Request a new code from the app.' });
  }

  if (new Date() > user.otpExpiresAt) {
    return res.status(400).json({ message: 'Code expired. Use “Resend code”.' });
  }

  const match = await bcrypt.compare(code, user.otpHash);
  if (!match) {
    return res.status(400).json({ message: 'Invalid verification code' });
  }

  user.isVerified = true;
  user.otpHash = null;
  user.otpExpiresAt = null;
  await user.save();

  return res.json({
    message: 'Email verified. You can sign in now.',
    isVerified: true,
    email: user.email,
  });
});

router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Do not reveal whether email exists
    return res.json({ message: 'If an account exists, a new code was sent.' });
  }

  if (user.isVerified) {
    return res.json({ message: 'This email is already verified. You can sign in.' });
  }

  try {
    await assignOtpAndEmail(user, email);
    return res.json({ message: 'A new verification code was sent to your email.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ message: 'Could not send email. Try again later.' });
  }
});

/** Verified accounts only — uses same otpHash fields as registration (no overlap for verified users). */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user || !user.isVerified) {
    return res.json({ message: GENERIC_RESET_MESSAGE });
  }

  try {
    await assignPasswordResetOtp(user, email);
    return res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    console.error('Forgot password error:', err);
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Mail is not configured') || msg.includes('ZOHO_EMAIL')) {
      return res.status(503).json({
        message: 'Email service is not configured on the server.',
      });
    }
    return res.status(500).json({ message: 'Could not send reset email. Try again later.' });
  }
});

router.post('/resend-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user || !user.isVerified) {
    return res.json({ message: GENERIC_RESET_MESSAGE });
  }

  try {
    await assignPasswordResetOtp(user, email);
    return res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    console.error('Resend password reset error:', err);
    return res.status(500).json({ message: 'Could not send email. Try again later.' });
  }
});

router.post('/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and code are required' });
  }

  const code = String(otp).replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) {
    return res.status(400).json({ message: 'Enter the 6-digit code from your email' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user || !user.isVerified) {
    return res.status(400).json({ message: 'Invalid or expired code' });
  }

  if (!user.otpHash || !user.otpExpiresAt) {
    return res.status(400).json({ message: 'No active reset code. Request a new one.' });
  }

  if (new Date() > user.otpExpiresAt) {
    return res.status(400).json({ message: 'Code expired. Request a new reset link.' });
  }

  const match = await bcrypt.compare(code, user.otpHash);
  if (!match) {
    return res.status(400).json({ message: 'Invalid code' });
  }

  user.otpHash = null;
  user.otpExpiresAt = null;
  await user.save();

  const secret = process.env.JWT_SECRET || 'dev-secret';
  const resetToken = jwt.sign(
    { userId: user.id, purpose: 'password-reset' },
    secret,
    { expiresIn: '15m' },
  );

  return res.json({
    message: 'Code verified. Set your new password.',
    resetToken,
  });
});

router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({ message: 'Reset token and new password are required' });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const secret = process.env.JWT_SECRET || 'dev-secret';
  let payload: { userId: number; purpose?: string };
  try {
    payload = jwt.verify(resetToken, secret) as { userId: number; purpose?: string };
  } catch {
    return res.status(400).json({ message: 'Invalid or expired reset link. Start again.' });
  }

  if (payload.purpose !== 'password-reset' || typeof payload.userId !== 'number') {
    return res.status(400).json({ message: 'Invalid reset token' });
  }

  const user = await User.findByPk(payload.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  return res.json({ message: 'Password updated. You can sign in now.' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      message: 'Please verify your email before signing in. Check your inbox for the code.',
      requiresVerification: true,
    });
  }

  const secret = process.env.JWT_SECRET || 'dev-secret';
  const token = jwt.sign({ userId: user.id }, secret, {
    expiresIn: '7d',
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isVerified: user.isVerified,
      canTransact: user.canTransact,
    },
  });
});

router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await User.findByPk(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isVerified: user.isVerified,
    canTransact: user.canTransact,
  });
});

router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const { fullName } = req.body;

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await User.findByPk(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (typeof fullName === 'string') {
    user.fullName = fullName;
  }

  await user.save();

  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  });
});

router.put('/change-password', authMiddleware, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: 'Current password and new password are required',
    });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({
      message: 'New password must be at least 8 characters',
    });
  }

  const user = await User.findByPk(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  return res.json({ message: 'Password updated successfully' });
});

router.delete('/account', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await User.findByPk(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  await user.destroy();
  return res.json({ message: 'Account deleted successfully' });
});

export default router;
