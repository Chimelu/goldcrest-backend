import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from 'sequelize';

export interface UserWalletAttributes {
  id: number;
  userId: number;
  /** USD available for buys (not in crypto). */
  availableUsd: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserWalletCreationAttributes = Optional<
  UserWalletAttributes,
  'id' | 'availableUsd'
>;

export class UserWallet
  extends Model<UserWalletAttributes, UserWalletCreationAttributes>
  implements UserWalletAttributes
{
  public id!: number;
  public userId!: number;
  public availableUsd!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function UserWalletFactory(sequelize: Sequelize) {
  UserWallet.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      availableUsd: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: '0.00',
      },
    },
    {
      sequelize,
      tableName: 'user_wallets',
      indexes: [{ fields: ['userId'], unique: true }],
    },
  );

  return UserWallet;
}
