import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from 'sequelize';

export interface CryptoHoldingAttributes {
  id: number;
  userId: number;
  /** e.g. BTC, ETH — uppercase in app logic */
  symbol: string;
  quantity: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type CryptoHoldingCreationAttributes = Optional<
  CryptoHoldingAttributes,
  'id'
>;

export class CryptoHolding
  extends Model<CryptoHoldingAttributes, CryptoHoldingCreationAttributes>
  implements CryptoHoldingAttributes
{
  public id!: number;
  public userId!: number;
  public symbol!: string;
  public quantity!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function CryptoHoldingFactory(sequelize: Sequelize) {
  CryptoHolding.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      symbol: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0',
      },
    },
    {
      sequelize,
      tableName: 'crypto_holdings',
      indexes: [{ unique: true, fields: ['userId', 'symbol'] }],
    },
  );

  return CryptoHolding;
}
