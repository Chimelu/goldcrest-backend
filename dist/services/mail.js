"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationOtp = sendVerificationOtp;
const nodemailer_1 = __importDefault(require("nodemailer"));
const ZOHO_EMAIL = process.env.ZOHO_EMAIL;
const ZOHO_PASSWORD = process.env.ZOHO_PASSWORD;
const ZOHO_SMTP_HOST = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
const ZOHO_SMTP_PORT = Number(process.env.ZOHO_SMTP_PORT || 465);
let transporter = null;
function getTransporter() {
    if (!ZOHO_EMAIL || !ZOHO_PASSWORD) {
        throw new Error('Mail is not configured. Set ZOHO_EMAIL and ZOHO_PASSWORD in your .env file.');
    }
    if (!transporter) {
        transporter = nodemailer_1.default.createTransport({
            host: ZOHO_SMTP_HOST,
            port: ZOHO_SMTP_PORT,
            secure: ZOHO_SMTP_PORT === 465,
            auth: {
                user: ZOHO_EMAIL,
                pass: ZOHO_PASSWORD,
            },
            ...(ZOHO_SMTP_PORT === 587
                ? {
                    requireTLS: true,
                }
                : {}),
        });
    }
    return transporter;
}
async function sendVerificationOtp(toEmail, otp) {
    const from = ZOHO_EMAIL;
    if (!from)
        throw new Error('ZOHO_EMAIL is not set');
    const transport = getTransporter();
    await transport.sendMail({
        from: `"Goldcrest" <${from}>`,
        to: toEmail,
        subject: 'Your Goldcrest verification code',
        text: `Your verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not create an account, you can ignore this email.`,
        html: `
      <p>Your verification code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This code expires in 15 minutes.</p>
      <p style="color: #666; font-size: 12px;">If you did not create an account, you can ignore this email.</p>
    `,
    });
}
