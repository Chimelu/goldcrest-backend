import { TradableAsset } from '../models';
import { DEFAULT_TRADABLE_ASSET_ROWS } from '../data/tradableAssetSeed';

/**
 * Inserts missing tradable rows (idempotent). Safe to call on every server start.
 */
export async function ensureTradableAssetsSeeded(): Promise<void> {
  await TradableAsset.bulkCreate(
    DEFAULT_TRADABLE_ASSET_ROWS.map(r => ({ ...r, isActive: true })),
    { ignoreDuplicates: true },
  );
}
