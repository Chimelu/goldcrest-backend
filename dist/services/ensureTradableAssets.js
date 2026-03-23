"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTradableAssetsSeeded = ensureTradableAssetsSeeded;
const models_1 = require("../models");
const tradableAssetSeed_1 = require("../data/tradableAssetSeed");
/**
 * Inserts missing tradable rows (idempotent). Safe to call on every server start.
 */
async function ensureTradableAssetsSeeded() {
    await models_1.TradableAsset.bulkCreate(tradableAssetSeed_1.DEFAULT_TRADABLE_ASSET_ROWS.map(r => ({ ...r, isActive: true })), { ignoreDuplicates: true });
}
