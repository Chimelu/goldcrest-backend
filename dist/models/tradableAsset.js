"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradableAsset = void 0;
exports.TradableAssetFactory = TradableAssetFactory;
const sequelize_1 = require("sequelize");
class TradableAsset extends sequelize_1.Model {
}
exports.TradableAsset = TradableAsset;
function TradableAssetFactory(sequelize) {
    TradableAsset.init({
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        symbol: {
            type: sequelize_1.DataTypes.STRING(20),
            allowNull: false,
            unique: true,
        },
        name: {
            type: sequelize_1.DataTypes.STRING(128),
            allowNull: false,
        },
        coingeckoId: {
            type: sequelize_1.DataTypes.STRING(64),
            allowNull: true,
        },
        isActive: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        sequelize,
        tableName: 'tradable_assets',
    });
    return TradableAsset;
}
