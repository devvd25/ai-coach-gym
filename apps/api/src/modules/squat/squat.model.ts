import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class SquatSessionModel extends Model<
  InferAttributes<SquatSessionModel>,
  InferCreationAttributes<SquatSessionModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare startedAt: Date;
  declare durationSec: number;
  declare repCount: number;
  declare avgMinKneeAngle: number | null;
  declare model: string;
  declare avgFps: number | null;
  declare createdAt: CreationOptional<Date>;
}

export function initSquatModel(sequelize: Sequelize): void {
  SquatSessionModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      durationSec: { type: DataTypes.INTEGER, allowNull: false },
      repCount: { type: DataTypes.INTEGER, allowNull: false },
      avgMinKneeAngle: { type: DataTypes.DECIMAL(4, 1), allowNull: true },
      model: { type: DataTypes.STRING(10), allowNull: false },
      avgFps: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: 'squat_sessions', underscored: true, updatedAt: false },
  );
}
