"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalRequest = void 0;
exports.WithdrawalRequestFactory = WithdrawalRequestFactory;
const sequelize_1 = require("sequelize");
class WithdrawalRequest extends sequelize_1.Model {
}
exports.WithdrawalRequest = WithdrawalRequest;
function WithdrawalRequestFactory(sequelize) {
    WithdrawalRequest.init({
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
        amountUsd: {
            type: sequelize_1.DataTypes.DECIMAL(18, 2),
            allowNull: false,
        },
        destinationAddress: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: false,
        },
        network: {
            type: sequelize_1.DataTypes.STRING(32),
            allowNull: false,
        },
        status: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'PENDING',
        },
        adminNote: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: 'withdrawal_requests',
        indexes: [{ fields: ['userId', 'status'] }, { fields: ['createdAt'] }],
    });
    return WithdrawalRequest;
}
