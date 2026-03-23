import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from 'sequelize';

export type WithdrawalStatus = 'PENDING' | 'COMPLETED' | 'REJECTED';

export interface WithdrawalRequestAttributes {
  id: number;
  userId: number;
  amountUsd: string;
  destinationAddress: string;
  network: string;
  status: WithdrawalStatus;
  adminNote: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type WithdrawalRequestCreationAttributes = Optional<
  WithdrawalRequestAttributes,
  'id' | 'adminNote'
>;

export class WithdrawalRequest
  extends Model<WithdrawalRequestAttributes, WithdrawalRequestCreationAttributes>
  implements WithdrawalRequestAttributes
{
  public id!: number;
  public userId!: number;
  public amountUsd!: string;
  public destinationAddress!: string;
  public network!: string;
  public status!: WithdrawalStatus;
  public adminNote!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function WithdrawalRequestFactory(sequelize: Sequelize) {
  WithdrawalRequest.init(
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
      amountUsd: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      destinationAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      network: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      adminNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'withdrawal_requests',
      indexes: [{ fields: ['userId', 'status'] }, { fields: ['createdAt'] }],
    },
  );

  return WithdrawalRequest;
}
