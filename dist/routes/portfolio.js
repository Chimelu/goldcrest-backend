"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const marketOrder_1 = require("../services/trade/marketOrder");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
/** Ensure wallet row exists (users registered before wallet feature). */
async function getOrCreateWallet(userId) {
    const [wallet] = await models_1.UserWallet.findOrCreate({
        where: { userId },
        defaults: { userId, availableUsd: '0.00' },
    });
    return wallet;
}
/**
 * GET /portfolio/summary
 * Matches mobile: USD cash + per-crypto quantities (client can × live price for totals).
 */
router.get('/summary', async (req, res) => {
    const userId = req.userId;
    try {
        const wallet = await getOrCreateWallet(userId);
        const holdings = await models_1.CryptoHolding.findAll({
            where: { userId },
            order: [['symbol', 'ASC']],
        });
        return res.json({
            availableUsd: String(wallet.availableUsd),
            holdings: holdings.map(h => ({
                symbol: h.symbol,
                quantity: String(h.quantity),
            })),
        });
    }
    catch (e) {
        console.error('portfolio/summary', e);
        return res.status(500).json({ message: 'Could not load portfolio' });
    }
});
/**
 * POST /portfolio/buy
 * Body: { symbol: string, spendUsd: number } — spend this many USD at live CoinGecko price.
 */
router.post('/buy', async (req, res) => {
    const userId = req.userId;
    const symbol = req.body?.symbol;
    const spendUsd = Number(req.body?.spendUsd);
    if (typeof symbol !== 'string' || !symbol.trim()) {
        return res.status(400).json({ message: 'symbol is required' });
    }
    if (!Number.isFinite(spendUsd) || spendUsd <= 0) {
        return res.status(400).json({ message: 'spendUsd must be a positive number' });
    }
    try {
        const result = await (0, marketOrder_1.executeMarketBuy)({ userId, symbol, spendUsd });
        return res.json({ message: 'Buy executed', ...result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Buy failed';
        const code = msg.includes('Insufficient') || msg.includes('not available')
            ? 400
            : msg.includes('CoinGecko') || msg.includes('price')
                ? 502
                : 500;
        console.error('portfolio/buy', e);
        return res.status(code).json({ message: msg });
    }
});
/**
 * POST /portfolio/sell
 * Body: { symbol: string, cryptoAmount: number } — sell this much crypto for USD.
 */
router.post('/sell', async (req, res) => {
    const userId = req.userId;
    const symbol = req.body?.symbol;
    const cryptoAmount = Number(req.body?.cryptoAmount);
    if (typeof symbol !== 'string' || !symbol.trim()) {
        return res.status(400).json({ message: 'symbol is required' });
    }
    if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) {
        return res.status(400).json({ message: 'cryptoAmount must be a positive number' });
    }
    try {
        const result = await (0, marketOrder_1.executeMarketSell)({ userId, symbol, cryptoAmount });
        return res.json({ message: 'Sell executed', ...result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Sell failed';
        const code = msg.includes('Insufficient') || msg.includes('not available')
            ? 400
            : msg.includes('CoinGecko') || msg.includes('price')
                ? 502
                : 500;
        console.error('portfolio/sell', e);
        return res.status(code).json({ message: msg });
    }
});
router.get('/transactions', async (req, res) => {
    const userId = req.userId;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    try {
        const rows = await models_1.AccountTransaction.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            limit,
        });
        return res.json({
            transactions: rows.map(t => ({
                id: t.id,
                kind: t.kind,
                status: t.status,
                cryptoSymbol: t.cryptoSymbol,
                cryptoAmount: t.cryptoAmount != null ? String(t.cryptoAmount) : null,
                unitPriceUsd: t.unitPriceUsd != null ? String(t.unitPriceUsd) : null,
                grossUsd: String(t.grossUsd),
                feeUsd: String(t.feeUsd),
                withdrawalRequestId: t.withdrawalRequestId,
                createdAt: t.createdAt.toISOString(),
            })),
        });
    }
    catch (e) {
        console.error('portfolio/transactions', e);
        return res.status(500).json({ message: 'Could not load transactions' });
    }
});
/**
 * POST /portfolio/withdrawals
 * Body: { amountUsd, destinationAddress, network } — debits USD, creates pending request for admin.
 */
router.post('/withdrawals', async (req, res) => {
    const userId = req.userId;
    const amountUsd = Number(req.body?.amountUsd);
    const destinationAddress = String(req.body?.destinationAddress ?? '').trim();
    const network = String(req.body?.network ?? 'ERC20').trim();
    if (!Number.isFinite(amountUsd) || amountUsd < 1) {
        return res.status(400).json({ message: 'Minimum withdrawal is $1.00' });
    }
    if (amountUsd > 1000000000) {
        return res.status(400).json({ message: 'Amount too large' });
    }
    if (destinationAddress.length < 10) {
        return res.status(400).json({ message: 'Enter a valid destination address' });
    }
    if (!network) {
        return res.status(400).json({ message: 'network is required' });
    }
    try {
        const result = await models_1.sequelize.transaction(async (t) => {
            const wallet = await models_1.UserWallet.findOne({
                where: { userId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            const avail = Number(wallet.availableUsd);
            const spend = Math.round(amountUsd * 100) / 100;
            if (avail + 1e-9 < spend) {
                throw new Error('Insufficient USD balance');
            }
            const wr = await models_1.WithdrawalRequest.create({
                userId,
                amountUsd: spend.toFixed(2),
                destinationAddress,
                network,
                status: 'PENDING',
                adminNote: null,
            }, { transaction: t });
            wallet.availableUsd = (avail - spend).toFixed(2);
            await wallet.save({ transaction: t });
            await models_1.AccountTransaction.create({
                userId,
                kind: 'WITHDRAW',
                status: 'PENDING',
                cryptoSymbol: null,
                cryptoAmount: null,
                unitPriceUsd: null,
                grossUsd: spend.toFixed(2),
                feeUsd: '0.00',
                idempotencyKey: null,
                withdrawalRequestId: wr.id,
            }, { transaction: t });
            return {
                id: wr.id,
                amountUsd: String(wr.amountUsd),
                destinationAddress: wr.destinationAddress,
                network: wr.network,
                status: wr.status,
                createdAt: wr.createdAt.toISOString(),
                newAvailableUsd: String(wallet.availableUsd),
            };
        });
        return res.status(201).json({ message: 'Withdrawal submitted', ...result });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Withdrawal failed';
        const code = msg.includes('Insufficient') || msg.includes('not found') ? 400 : 500;
        console.error('portfolio/withdrawals POST', e);
        return res.status(code).json({ message: msg });
    }
});
/**
 * GET /portfolio/withdrawals
 */
router.get('/withdrawals', async (req, res) => {
    const userId = req.userId;
    try {
        const rows = await models_1.WithdrawalRequest.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            limit: 100,
        });
        return res.json({
            withdrawals: rows.map(w => ({
                id: w.id,
                amountUsd: String(w.amountUsd),
                destinationAddress: w.destinationAddress,
                network: w.network,
                status: w.status,
                adminNote: w.adminNote,
                createdAt: w.createdAt.toISOString(),
                updatedAt: w.updatedAt.toISOString(),
            })),
        });
    }
    catch (e) {
        console.error('portfolio/withdrawals GET', e);
        return res.status(500).json({ message: 'Could not load withdrawals' });
    }
});
exports.default = router;
