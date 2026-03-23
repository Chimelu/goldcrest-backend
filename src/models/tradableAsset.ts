import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from 'sequelize';

/**
 * Catalog of symbols the app allows to trade (validates buys/sells server-side).
 * Seed from mobile `tradingAssets` crypto rows or migrations.
 */
export interface TradableAssetAttributes {
  id: number;
  symbol: string;
  name: string;
  coingeckoId: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type TradableAssetCreationAttributes = Optional<
  TradableAssetAttributes,
  'id' | 'coingeckoId' | 'isActive'
>;

export class TradableAsset
  extends Model<TradableAssetAttributes, TradableAssetCreationAttributes>
  implements TradableAssetAttributes
{
  public id!: number;
  public symbol!: string;
  public name!: string;
  public coingeckoId!: string | null;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function TradableAssetFactory(sequelize: Sequelize) {
  TradableAsset.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      symbol: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      coingeckoId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: 'tradable_assets',
    },
  );

  return TradableAsset;
}
