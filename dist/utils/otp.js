"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTP_TTL_MS = void 0;
exports.generateOtp = generateOtp;
const crypto_1 = __importDefault(require("crypto"));
/** 6-digit numeric OTP */
function generateOtp() {
    return String(crypto_1.default.randomInt(100000, 1000000));
}
exports.OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes
