import {
  AccountTransaction,
  CryptoHolding,
  TradableAsset,
  UserWallet,
  sequelize,
} from '../../models';
import { fetchUsdPriceForCoingeckoId } from '../coingecko';

function toUsd2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function addUsd(current: string, delta: number): string {
  const next = Math.round((Number(current) + delta) * 100) / 100;
  if (!Number.isFinite(next) || next < 0) {
    throw new Error('Invalid USD balance');
  }
  return next.toFixed(2);
}

function subUsd(current: string, spend: number): string {
  const next = Math.round((Number(current) - spend) * 100) / 100;
  if (!Number.isFinite(next) || next < -0.0001) {
    throw new Error('Insufficient USD balance');
  }
  return next.toFixed(2);
}

function addCryptoQty(current: string, add: number): string {
  const next = Number(current) + add;
  if (!Number.isFinite(next) || next < 0) {
    throw new Error('Invalid crypto quantity');
  }
  return next.toFixed(18);
}

function subCryptoQty(current: string, sell: number): string {
  const next = Number(current) - sell;
  if (!Number.isFinite(next) || next < -1e-12) {
    throw new Error('Insufficient crypto balance');
  }
  if (next < 1e-12) return '0';
  return next.toFixed(18);
}

async function loadTradable(symbolUpper: string) {
  const row = await TradableAsset.findOne({
    where: { symbol: symbolUpper, isActive: true },
  });
  if (!row?.coingeckoId) {
    throw new Error(`Symbol not available for trading: ${symbolUpper}`);
  }
  return row;
}

export type MarketBuyResult = {
  symbol: string;
  spendUsd: string;
  unitPriceUsd: string;
  cryptoAmount: string;
  newAvailableUsd: string;
  newQuantity: string;
};

/**
 * Spend USD from wallet, credit crypto at live CoinGecko USD price.
 */
export async function executeMarketBuy(params: {
  userId: number;
  symbol: string;
  spendUsd: number;
}): Promise<MarketBuyResult> {
  const symbol = params.symbol.trim().toUpperCase();
  if (params.spendUsd <= 0 || params.spendUsd > 1_000_000_000) {
    throw new Error('Invalid spend amount');
  }

  const spendStr = toUsd2(params.spendUsd);
  const spendNum = Number(spendStr);

  const tradable = await loadTradable(symbol);
  const unitPriceUsd = await fetchUsdPriceForCoingeckoId(tradable.coingeckoId!);
  const cryptoAmountNum = spendNum / unitPriceUsd;
  if (!Number.isFinite(cryptoAmountNum) || cryptoAmountNum <= 0) {
    throw new Error('Could not compute crypto amount');
  }
  const cryptoStr = cryptoAmountNum.toFixed(18);
  const feeUsd = 0;

  return sequelize.transaction(async t => {
    await UserWallet.findOrCreate({
      where: { userId: params.userId },
      defaults: { userId: params.userId, availableUsd: '0.00' },
      transaction: t,
    });

    const w = await UserWallet.findOne({
      where: { userId: params.userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!w) throw new Error('Wallet not found');

    const totalOut = spendNum + feeUsd;
    if (Number(w.availableUsd) + 1e-9 < totalOut) {
      throw new Error('Insufficient USD balance');
    }

    w.availableUsd = subUsd(String(w.availableUsd), totalOut);
    await w.save({ transaction: t });

    const [holding] = await CryptoHolding.findOrCreate({
      where: { userId: params.userId, symbol },
      defaults: { userId: params.userId, symbol, quantity: '0' },
      transaction: t,
    });

    const h = await CryptoHolding.findOne({
      where: { userId: params.userId, symbol },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!h) throw new Error('Could not update holding');

    h.quantity = addCryptoQty(String(h.quantity), cryptoAmountNum);
    await h.save({ transaction: t });

    await AccountTransaction.create(
      {
        userId: params.userId,
        kind: 'BUY',
        status: 'COMPLETED',
        cryptoSymbol: symbol,
        cryptoAmount: cryptoStr,
        unitPriceUsd: unitPriceUsd.toFixed(8),
        grossUsd: spendStr,
        feeUsd: feeUsd.toFixed(2),
        idempotencyKey: null,
      },
      { transaction: t },
    );

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

export type MarketSellResult = {
  symbol: string;
  cryptoAmount: string;
  unitPriceUsd: string;
  grossUsd: string;
  newAvailableUsd: string;
  newQuantity: string;
};

/**
 * Sell crypto for USD at live CoinGecko price; credit USD to wallet.
 */
export async function executeMarketSell(params: {
  userId: number;
  symbol: string;
  cryptoAmount: number;
}): Promise<MarketSellResult> {
  const symbol = params.symbol.trim().toUpperCase();
  if (params.cryptoAmount <= 0 || params.cryptoAmount > 1e15) {
    throw new Error('Invalid crypto amount');
  }

  const tradable = await loadTradable(symbol);
  const unitPriceUsd = await fetchUsdPriceForCoingeckoId(tradable.coingeckoId!);
  const grossUsdNum = params.cryptoAmount * unitPriceUsd;
  if (!Number.isFinite(grossUsdNum) || grossUsdNum <= 0) {
    throw new Error('Could not compute proceeds');
  }
  const feeUsd = 0;
  const creditUsd = grossUsdNum - feeUsd;
  const cryptoStr = params.cryptoAmount.toFixed(18);

  return sequelize.transaction(async t => {
    const w = await UserWallet.findOne({
      where: { userId: params.userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!w) {
      throw new Error('Wallet not found — open portfolio once after sign-in');
    }

    const holding = await CryptoHolding.findOne({
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

    await AccountTransaction.create(
      {
        userId: params.userId,
        kind: 'SELL',
        status: 'COMPLETED',
        cryptoSymbol: symbol,
        cryptoAmount: cryptoStr,
        unitPriceUsd: unitPriceUsd.toFixed(8),
        grossUsd: toUsd2(grossUsdNum),
        feeUsd: feeUsd.toFixed(2),
        idempotencyKey: null,
      },
      { transaction: t },
    );

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
