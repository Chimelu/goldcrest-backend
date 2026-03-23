import { Sequelize } from 'sequelize';
import pg from 'pg';
import { UserFactory } from './user';
import { UserWalletFactory } from './userWallet';
import { CryptoHoldingFactory } from './cryptoHolding';
import { WithdrawalRequestFactory } from './withdrawalRequest';
import { AccountTransactionFactory } from './accountTransaction';
import { TradableAssetFactory } from './tradableAsset';

const dbUrl = process.env.DATABASE_URL;

export const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
      dialect: 'postgres',
      dialectModule: pg,
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'goldcrest',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      },
    );

export const User = UserFactory(sequelize);
export const UserWallet = UserWalletFactory(sequelize);
export const CryptoHolding = CryptoHoldingFactory(sequelize);
export const WithdrawalRequest = WithdrawalRequestFactory(sequelize);
export const AccountTransaction = AccountTransactionFactory(sequelize);
export const TradableAsset = TradableAssetFactory(sequelize);

User.hasOne(UserWallet, { foreignKey: 'userId', as: 'wallet' });
UserWallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(CryptoHolding, { foreignKey: 'userId', as: 'holdings' });
CryptoHolding.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AccountTransaction, { foreignKey: 'userId', as: 'transactions' });
AccountTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(WithdrawalRequest, { foreignKey: 'userId', as: 'withdrawalRequests' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });

WithdrawalRequest.hasMany(AccountTransaction, {
  foreignKey: 'withdrawalRequestId',
  as: 'ledgerEntries',
});
AccountTransaction.belongsTo(WithdrawalRequest, {
  foreignKey: 'withdrawalRequestId',
  as: 'withdrawalRequest',
});
