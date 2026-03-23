/**
 * Manual seed (usually not needed — server runs this on startup).
 * npm run seed:tradable
 */
import 'dotenv/config';
import { sequelize } from '../models';
import { ensureTradableAssetsSeeded } from '../services/ensureTradableAssets';

async function main() {
  await sequelize.authenticate();
  await ensureTradableAssetsSeeded();
  console.log('Tradable assets OK (duplicates skipped).');
  await sequelize.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
