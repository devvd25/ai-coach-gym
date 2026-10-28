import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare passwordHash: string;
  declare fullName: string;
  declare healthConsentAt: CreationOptional<Date | null>;
  declare consentCamera: CreationOptional<boolean>;
  declare consentResearch: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize): void {
  UserModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      fullName: { type: DataTypes.STRING(120), allowNull: false },
      healthConsentAt: { type: DataTypes.DATE, allowNull: true },
      consentCamera: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      consentResearch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: 'users', underscored: true },
  );
}
