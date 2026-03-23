"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Manual seed (usually not needed — server runs this on startup).
 * npm run seed:tradable
 */
require("dotenv/config");
const models_1 = require("../models");
const ensureTradableAssets_1 = require("../services/ensureTradableAssets");
async function main() {
    await models_1.sequelize.authenticate();
    await (0, ensureTradableAssets_1.ensureTradableAssetsSeeded)();
    console.log('Tradable assets OK (duplicates skipped).');
    await models_1.sequelize.close();
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});
