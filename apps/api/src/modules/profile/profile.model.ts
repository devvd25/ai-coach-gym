import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class ProfileModel extends Model<
  InferAttributes<ProfileModel>,
  InferCreationAttributes<ProfileModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare goal: string;
  declare sex: string;
  declare age: number;
  declare heightCm: number;
  declare weightKg: number;
  declare level: string;
  declare injuries: string;
  declare sessionsPerWeek: number;
  declare sessionMinutes: number;
  /** JSON text, parsed in the repository. */
  declare preferredDays: string;
  declare location: string;
  /** JSON text, parsed in the repository. */
  declare equipment: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initProfileModel(sequelize: Sequelize): void {
  ProfileModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      goal: { type: DataTypes.STRING(20), allowNull: false },
      sex: { type: DataTypes.STRING(10), allowNull: false },
      age: { type: DataTypes.INTEGER, allowNull: false },
      heightCm: { type: DataTypes.DECIMAL(5, 1), allowNull: false },
      weightKg: { type: DataTypes.DECIMAL(5, 1), allowNull: false },
      level: { type: DataTypes.STRING(20), allowNull: false },
      injuries: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
      sessionsPerWeek: { type: DataTypes.INTEGER, allowNull: false },
      sessionMinutes: { type: DataTypes.INTEGER, allowNull: false },
      preferredDays: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '[]' },
      location: { type: DataTypes.STRING(10), allowNull: false },
      equipment: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '[]' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: 'profiles', underscored: true },
  );
}
