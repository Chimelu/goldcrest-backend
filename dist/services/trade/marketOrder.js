"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeMarketBuy = executeMarketBuy;
exports.executeMarketSell = executeMarketSell;
const models_1 = require("../../models");
const coingecko_1 = require("../coingecko");
function toUsd2(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
}
function addUsd(current, delta) {
    const next = Math.round((Number(current) + delta) * 100) / 100;
    if (!Number.isFinite(next) || next < 0) {
        throw new Error('Invalid USD balance');
    }
    return next.toFixed(2);
}
function subUsd(current, spend) {
    const next = Math.round((Number(current) - spend) * 100) / 100;
    if (!Number.isFinite(next) || next < -0.0001) {
        throw new Error('Insufficient USD balance');
    }
    return next.toFixed(2);
}
function addCryptoQty(current, add) {
    const next = Number(current) + add;
    if (!Number.isFinite(next) || next < 0) {
        throw new Error('Invalid crypto quantity');
    }
    return next.toFixed(18);
}
function subCryptoQty(current, sell) {
    const next = Number(current) - sell;
    if (!Number.isFinite(next) || next < -1e-12) {
        throw new Error('Insufficient crypto balance');
    }
    if (next < 1e-12)
        return '0';
    return next.toFixed(18);
}
async function loadTradable(symbolUpper) {
    const row = await models_1.TradableAsset.findOne({
        where: { symbol: symbolUpper, isActive: true },
    });
    if (!row?.coingeckoId) {
        throw new Error(`Symbol not available for trading: ${symbolUpper}`);
    }
    return row;
}
/**
 * Spend USD from wallet, credit crypto at live CoinGecko USD price.
 */
async function executeMarketBuy(params) {
    const symbol = params.symbol.trim().toUpperCase();
    if (params.spendUsd <= 0 || params.spendUsd > 1000000000) {
        throw new Error('Invalid spend amount');
    }
    const spendStr = toUsd2(params.spendUsd);
    const spendNum = Number(spendStr);
    const tradable = await loadTradable(symbol);
    const unitPriceUsd = await (0, coingecko_1.fetchUsdPriceForCoingeckoId)(tradable.coingeckoId);
    const cryptoAmountNum = spendNum / unitPriceUsd;
    if (!Number.isFinite(cryptoAmountNum) || cryptoAmountNum <= 0) {
        throw new Error('Could not compute crypto amount');
    }
    const cryptoStr = cryptoAmountNum.toFixed(18);
    const feeUsd = 0;
    return models_1.sequelize.transaction(async (t) => {
        await models_1.UserWallet.findOrCreate({
            where: { userId: params.userId },
            defaults: { userId: params.userId, availableUsd: '0.00' },
            transaction: t,
        });
        const w = await models_1.UserWallet.findOne({
            where: { userId: params.userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!w)
            throw new Error('Wallet not found');
        const totalOut = spendNum + feeUsd;
        if (Number(w.availableUsd) + 1e-9 < totalOut) {
            throw new Error('Insufficient USD balance');
        }
        w.availableUsd = subUsd(String(w.availableUsd), totalOut);
        await w.save({ transaction: t });
        const [holding] = await models_1.CryptoHolding.findOrCreate({
            where: { userId: params.userId, symbol },
            defaults: { userId: params.userId, symbol, quantity: '0' },
            transaction: t,
        });
        const h = await models_1.CryptoHolding.findOne({
            where: { userId: params.userId, symbol },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!h)
            throw new Error('Could not update holding');
        h.quantity = addCryptoQty(String(h.quantity), cryptoAmountNum);
        await h.save({ transaction: t });
        await models_1.AccountTransaction.create({
            userId: params.userId,
            kind: 'BUY',
            status: 'COMPLETED',
            cryptoSymbol: symbol,
            cryptoAmount: cryptoStr,
            unitPriceUsd: unitPriceUsd.toFixed(8),
            grossUsd: spendStr,
            feeUsd: feeUsd.toFixed(2),
            idempotencyKey: null,
        }, { transaction: t });
        return {
            symbol,
            spendUsd: spendStr,
            unitPriceUsd: unitPriceUsd.toFixed(8),
            cryptoAmount: cryptoStr,
            newAvailableUsd: String(w.availableUsd),
            newQuantity: String(h.quantity),
        };
    });
}
/**
 * Sell crypto for USD at live CoinGecko price; credit USD to wallet.
 */
async function executeMarketSell(params) {
    const symbol = params.symbol.trim().toUpperCase();
    if (params.cryptoAmount <= 0 || params.cryptoAmount > 1e15) {
        throw new Error('Invalid crypto amount');
    }
    const tradable = await loadTradable(symbol);
    const unitPriceUsd = await (0, coingecko_1.fetchUsdPriceForCoingeckoId)(tradable.coingeckoId);
    const grossUsdNum = params.cryptoAmount * unitPriceUsd;
    if (!Number.isFinite(grossUsdNum) || grossUsdNum <= 0) {
        throw new Error('Could not compute proceeds');
    }
    const feeUsd = 0;
    const creditUsd = grossUsdNum - feeUsd;
    const cryptoStr = params.cryptoAmount.toFixed(18);
    return models_1.sequelize.transaction(async (t) => {
        const w = await models_1.UserWallet.findOne({
            where: { userId: params.userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!w) {
            throw new Error('Wallet not found — open portfolio once after sign-in');
        }
        const holding = await models_1.CryptoHolding.findOne({
            where: { userId: params.userId, symbol },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!holding || Number(holding.quantity) + 1e-18 < params.cryptoAmount) {
            throw new Error('Insufficient crypto balance');
        }
        holding.quantity = subCryptoQty(String(holding.quantity), params.cryptoAmount);
        await holding.save({ transaction: t });
        w.availableUsd = addUsd(String(w.availableUsd), creditUsd);
        await w.save({ transaction: t });
        await models_1.AccountTransaction.create({
            userId: params.userId,
            kind: 'SELL',
            status: 'COMPLETED',
            cryptoSymbol: symbol,
            cryptoAmount: cryptoStr,
            unitPriceUsd: unitPriceUsd.toFixed(8),
            grossUsd: toUsd2(grossUsdNum),
            feeUsd: feeUsd.toFixed(2),
            idempotencyKey: null,
        }, { transaction: t });
        return {
            symbol,
            cryptoAmount: cryptoStr,
            unitPriceUsd: unitPriceUsd.toFixed(8),
            grossUsd: toUsd2(grossUsdNum),
            newAvailableUsd: String(w.availableUsd),
            newQuantity: String(holding.quantity),
        };
    });
}
