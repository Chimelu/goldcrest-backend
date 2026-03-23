"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoHolding = void 0;
exports.CryptoHoldingFactory = CryptoHoldingFactory;
const sequelize_1 = require("sequelize");
class CryptoHolding extends sequelize_1.Model {
}
exports.CryptoHolding = CryptoHolding;
function CryptoHoldingFactory(sequelize) {
    CryptoHolding.init({
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
        symbol: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: false,
        },
        quantity: {
            type: sequelize_1.DataTypes.DECIMAL(36, 18),
            allowNull: false,
            defaultValue: '0',
        },
    }, {
        sequelize,
        tableName: 'crypto_holdings',
        indexes: [{ unique: true, fields: ['userId', 'symbol'] }],
    });
    return CryptoHolding;
}
