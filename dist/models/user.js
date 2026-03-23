"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
exports.UserFactory = UserFactory;
const sequelize_1 = require("sequelize");
class User extends sequelize_1.Model {
}
exports.User = User;
function UserFactory(sequelize) {
    User.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        email: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        passwordHash: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        fullName: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        isVerified: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        canTransact: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        otpHash: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        },
        otpExpiresAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: 'users',
    });
    return User;
}
