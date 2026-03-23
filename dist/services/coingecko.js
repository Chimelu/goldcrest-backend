"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUsdPriceForCoingeckoId = fetchUsdPriceForCoingeckoId;
/**
 * Fetch spot USD price from CoinGecko public API (no key required for low volume).
 * https://docs.coingecko.com/reference/simple-price
 */
async function fetchUsdPriceForCoingeckoId(coingeckoId) {
    const id = encodeURIComponent(coingeckoId.trim().toLowerCase());
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
        res = await fetch(url, { signal: controller.signal });
    }
    finally {
        clearTimeout(t);
    }
    if (!res.ok) {
        throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    const json = (await res.json());
    const row = json[coingeckoId.toLowerCase()];
    const usd = row?.usd;
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) {
        throw new Error('Invalid price from CoinGecko');
    }
    return usd;
}
