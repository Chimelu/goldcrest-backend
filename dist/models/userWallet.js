"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserWallet = void 0;
exports.UserWalletFactory = UserWalletFactory;
const sequelize_1 = require("sequelize");
class UserWallet extends sequelize_1.Model {
}
exports.UserWallet = UserWallet;
function UserWalletFactory(sequelize) {
    UserWallet.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            unique: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
        availableUsd: {
            type: sequelize_1.DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: '0.00',
        },
    }, {
        sequelize,
        tableName: 'user_wallets',
        indexes: [{ fields: ['userId'], unique: true }],
    });
    return UserWallet;
}
