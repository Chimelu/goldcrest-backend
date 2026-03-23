"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountTransaction = void 0;
exports.AccountTransactionFactory = AccountTransactionFactory;
const sequelize_1 = require("sequelize");
class AccountTransaction extends sequelize_1.Model {
}
exports.AccountTransaction = AccountTransaction;
function AccountTransactionFactory(sequelize) {
    AccountTransaction.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
        kind: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: false,
        },
        status: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'COMPLETED',
        },
        cryptoSymbol: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: true,
        },
        cryptoAmount: {
            type: sequelize_1.DataTypes.DECIMAL(36, 18),
            allowNull: true,
        },
        unitPriceUsd: {
            type: sequelize_1.DataTypes.DECIMAL(24, 8),
            allowNull: true,
        },
        grossUsd: {
            type: sequelize_1.DataTypes.DECIMAL(18, 2),
            allowNull: false,
        },
        feeUsd: {
            type: sequelize_1.DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: '0.00',
        },
        idempotencyKey: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: true,
            unique: true,
        },
        withdrawalRequestId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: { model: 'withdrawal_requests', key: 'id' },
            onDelete: 'SET NULL',
        },
    }, {
        sequelize,
        tableName: 'account_transactions',
        indexes: [
            { fields: ['userId', 'createdAt'] },
            { fields: ['userId', 'kind'] },
            { fields: ['withdrawalRequestId'] },
        ],
    });
    return AccountTransaction;
}
