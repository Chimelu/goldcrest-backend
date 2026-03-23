"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const mail_1 = require("../services/mail");
const otp_1 = require("../utils/otp");
const router = (0, express_1.Router)();
async function assignOtpAndEmail(user, email) {
    const otp = (0, otp_1.generateOtp)();
    const otpHash = await bcrypt_1.default.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + otp_1.OTP_TTL_MS);
    user.otpHash = otpHash;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    await (0, mail_1.sendVerificationOtp)(email, otp);
}
async function assignPasswordResetOtp(user, email) {
    const otp = (0, otp_1.generateOtp)();
    const otpHash = await bcrypt_1.default.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + otp_1.OTP_TTL_MS);
    user.otpHash = otpHash;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    await (0, mail_1.sendPasswordResetOtp)(email, otp);
}
const GENERIC_RESET_MESSAGE = 'If an account exists for this email, you will receive a reset code shortly.';
router.post('/register', async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    const existing = await models_1.User.findOne({ where: { email } });
    if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
    }
    let created;
    try {
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        created = await models_1.User.create({
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
    }
    catch (err) {
        if (created?.id) {
            await models_1.User.destroy({ where: { id: created.id } }).catch(() => undefined);
        }
        console.error('Register / mail error:', err);
        const msg = err instanceof Error ? err.message : 'Registration failed';
        if (msg.includes('Mail is not configured') || msg.includes('ZOHO_EMAIL')) {
            return res.status(503).json({
                message: 'Email service is not configured on the server. Ask the admin to set ZOHO_EMAIL and ZOHO_PASSWORD.',
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
    const user = await models_1.User.findOne({ where: { email } });
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
    const match = await bcrypt_1.default.compare(code, user.otpHash);
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
    const user = await models_1.User.findOne({ where: { email } });
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
    }
    catch (err) {
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
    const user = await models_1.User.findOne({ where: { email } });
    if (!user || !user.isVerified) {
        return res.json({ message: GENERIC_RESET_MESSAGE });
    }
    try {
        await assignPasswordResetOtp(user, email);
        return res.json({ message: GENERIC_RESET_MESSAGE });
    }
    catch (err) {
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
    const user = await models_1.User.findOne({ where: { email } });
    if (!user || !user.isVerified) {
        return res.json({ message: GENERIC_RESET_MESSAGE });
    }
    try {
        await assignPasswordResetOtp(user, email);
        return res.json({ message: GENERIC_RESET_MESSAGE });
    }
    catch (err) {
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
    const user = await models_1.User.findOne({ where: { email } });
    if (!user || !user.isVerified) {
        return res.status(400).json({ message: 'Invalid or expired code' });
    }
    if (!user.otpHash || !user.otpExpiresAt) {
        return res.status(400).json({ message: 'No active reset code. Request a new one.' });
    }
    if (new Date() > user.otpExpiresAt) {
        return res.status(400).json({ message: 'Code expired. Request a new reset link.' });
    }
    const match = await bcrypt_1.default.compare(code, user.otpHash);
    if (!match) {
        return res.status(400).json({ message: 'Invalid code' });
    }
    user.otpHash = null;
    user.otpExpiresAt = null;
    await user.save();
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const resetToken = jsonwebtoken_1.default.sign({ userId: user.id, purpose: 'password-reset' }, secret, { expiresIn: '15m' });
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
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(resetToken, secret);
    }
    catch {
        return res.status(400).json({ message: 'Invalid or expired reset link. Start again.' });
    }
    if (payload.purpose !== 'password-reset' || typeof payload.userId !== 'number') {
        return res.status(400).json({ message: 'Invalid reset token' });
    }
    const user = await models_1.User.findByPk(payload.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    user.passwordHash = await bcrypt_1.default.hash(String(newPassword), 10);
    await user.save();
    return res.json({ message: 'Password updated. You can sign in now.' });
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await models_1.User.findOne({ where: { email } });
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
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
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, secret, {
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
router.get('/profile', auth_1.authMiddleware, async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const user = await models_1.User.findByPk(req.userId);
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
router.put('/profile', auth_1.authMiddleware, async (req, res) => {
    const { fullName } = req.body;
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const user = await models_1.User.findByPk(req.userId);
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
router.put('/change-password', auth_1.authMiddleware, async (req, res) => {
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
    const user = await models_1.User.findByPk(req.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const ok = await bcrypt_1.default.compare(String(currentPassword), user.passwordHash);
    if (!ok) {
        return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.passwordHash = await bcrypt_1.default.hash(String(newPassword), 10);
    await user.save();
    return res.json({ message: 'Password updated successfully' });
});
router.delete('/account', auth_1.authMiddleware, async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const user = await models_1.User.findByPk(req.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    await user.destroy();
    return res.json({ message: 'Account deleted successfully' });
});
exports.default = router;
