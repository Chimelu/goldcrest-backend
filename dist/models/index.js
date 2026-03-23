"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradableAsset = exports.AccountTransaction = exports.WithdrawalRequest = exports.CryptoHolding = exports.UserWallet = exports.User = exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const pg_1 = __importDefault(require("pg"));
const user_1 = require("./user");
const userWallet_1 = require("./userWallet");
const cryptoHolding_1 = require("./cryptoHolding");
const withdrawalRequest_1 = require("./withdrawalRequest");
const accountTransaction_1 = require("./accountTransaction");
const tradableAsset_1 = require("./tradableAsset");
const dbUrl = process.env.DATABASE_URL;
exports.sequelize = dbUrl
    ? new sequelize_1.Sequelize(dbUrl, {
        dialect: 'postgres',
        dialectModule: pg_1.default,
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
    })
    : new sequelize_1.Sequelize(process.env.DB_NAME || 'goldcrest', process.env.DB_USER || 'postgres', process.env.DB_PASSWORD || '', {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        dialect: 'postgres',
        dialectModule: pg_1.default,
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
    });
exports.User = (0, user_1.UserFactory)(exports.sequelize);
exports.UserWallet = (0, userWallet_1.UserWalletFactory)(exports.sequelize);
exports.CryptoHolding = (0, cryptoHolding_1.CryptoHoldingFactory)(exports.sequelize);
exports.WithdrawalRequest = (0, withdrawalRequest_1.WithdrawalRequestFactory)(exports.sequelize);
exports.AccountTransaction = (0, accountTransaction_1.AccountTransactionFactory)(exports.sequelize);
exports.TradableAsset = (0, tradableAsset_1.TradableAssetFactory)(exports.sequelize);
exports.User.hasOne(exports.UserWallet, { foreignKey: 'userId', as: 'wallet' });
exports.UserWallet.belongsTo(exports.User, { foreignKey: 'userId', as: 'user' });
exports.User.hasMany(exports.CryptoHolding, { foreignKey: 'userId', as: 'holdings' });
exports.CryptoHolding.belongsTo(exports.User, { foreignKey: 'userId', as: 'user' });
exports.User.hasMany(exports.AccountTransaction, { foreignKey: 'userId', as: 'transactions' });
exports.AccountTransaction.belongsTo(exports.User, { foreignKey: 'userId', as: 'user' });
exports.User.hasMany(exports.WithdrawalRequest, { foreignKey: 'userId', as: 'withdrawalRequests' });
exports.WithdrawalRequest.belongsTo(exports.User, { foreignKey: 'userId', as: 'user' });
exports.WithdrawalRequest.hasMany(exports.AccountTransaction, {
    foreignKey: 'withdrawalRequestId',
    as: 'ledgerEntries',
});
exports.AccountTransaction.belongsTo(exports.WithdrawalRequest, {
    foreignKey: 'withdrawalRequestId',
    as: 'withdrawalRequest',
});
