import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from 'sequelize';

export type AccountTransactionKind =
  | 'BUY'
  | 'SELL'
  | 'DEPOSIT'
  | 'WITHDRAW';

export type AccountTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface AccountTransactionAttributes {
  id: number;
  userId: number;
  kind: AccountTransactionKind;
  status: AccountTransactionStatus;
  /** Crypto ticker for BUY/SELL; null for pure USD deposit/withdraw. */
  cryptoSymbol: string | null;
  /** Crypto amount filled (bought or sold); null if not applicable. */
  cryptoAmount: string | null;
  /** Executed or quoted USD price per 1 unit of crypto. */
  unitPriceUsd: string | null;
  /** Gross USD notional (e.g. USD spent on buy before fee, or USD proceeds before fee on sell). */
  grossUsd: string;
  feeUsd: string;
  /** Optional idempotency for POST retries */
  idempotencyKey: string | null;
  /** Links WITHDRAW rows to a withdrawal request */
  withdrawalRequestId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AccountTransactionCreationAttributes = Optional<
  AccountTransactionAttributes,
  | 'id'
  | 'status'
  | 'cryptoSymbol'
  | 'cryptoAmount'
  | 'unitPriceUsd'
  | 'feeUsd'
  | 'idempotencyKey'
  | 'withdrawalRequestId'
>;

export class AccountTransaction
  extends Model<AccountTransactionAttributes, AccountTransactionCreationAttributes>
  implements AccountTransactionAttributes
{
  public id!: number;
  public userId!: number;
  public kind!: AccountTransactionKind;
  public status!: AccountTransactionStatus;
  public cryptoSymbol!: string | null;
  public cryptoAmount!: string | null;
  public unitPriceUsd!: string | null;
  public grossUsd!: string;
  public feeUsd!: string;
  public idempotencyKey!: string | null;
  public withdrawalRequestId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function AccountTransactionFactory(sequelize: Sequelize) {
  AccountTransaction.init(
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
      kind: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'COMPLETED',
      },
      cryptoSymbol: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      cryptoAmount: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: true,
      },
      unitPriceUsd: {
        type: DataTypes.DECIMAL(24, 8),
        allowNull: true,
      },
      grossUsd: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      feeUsd: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: '0.00',
      },
      idempotencyKey: {
        type: DataTypes.STRING(64),
        allowNull: true,
        unique: true,
      },
      withdrawalRequestId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'withdrawal_requests', key: 'id' },
        onDelete: 'SET NULL',
      },
    },
    {
      sequelize,
      tableName: 'account_transactions',
      indexes: [
        { fields: ['userId', 'createdAt'] },
        { fields: ['userId', 'kind'] },
        { fields: ['withdrawalRequestId'] },
      ],
    },
  );

  return AccountTransaction;
}
