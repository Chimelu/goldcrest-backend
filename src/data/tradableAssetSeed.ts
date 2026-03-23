/**
 * Default catalog for buy/sell — must match symbols the mobile app can trade.
 */
export const DEFAULT_TRADABLE_ASSET_ROWS = [
  { symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum' },
  { symbol: 'USDT', name: 'Tether', coingeckoId: 'tether' },
  { symbol: 'BNB', name: 'BNB', coingeckoId: 'binancecoin' },
  { symbol: 'XRP', name: 'XRP', coingeckoId: 'ripple' },
  { symbol: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin' },
  { symbol: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin' },
  { symbol: 'XLM', name: 'Stellar', coingeckoId: 'stellar' },
] as const;
