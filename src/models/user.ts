import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from 'sequelize';

interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string | null;
  isVerified: boolean;
  otpHash: string | null;
  otpExpiresAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'fullName' | 'isVerified' | 'otpHash' | 'otpExpiresAt'
>;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public email!: string;
  public passwordHash!: string;
  public fullName!: string | null;
  public isVerified!: boolean;
  public otpHash!: string | null;
  public otpExpiresAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function UserFactory(sequelize: Sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      otpHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otpExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'users',
    },
  );

  return User;
}
