import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class AiRequestModel extends Model<
  InferAttributes<AiRequestModel>,
  InferCreationAttributes<AiRequestModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare task: string;
  declare model: string;
  declare promptVersion: string;
  declare latencyMs: number;
  declare schemaValid: boolean;
  declare retryCount: number;
  /** JSON array of strings. */
  declare violations: string;
  declare usedFallback: boolean;
  declare outputTokens: number | null;
  declare error: string | null;
  declare createdAt: CreationOptional<Date>;
}

export class NutritionDayModel extends Model<
  InferAttributes<NutritionDayModel>,
  InferCreationAttributes<NutritionDayModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare date: string;
  declare source: string;
  /** JSON: { targets, meals, explanation }. */
  declare data: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initAiModels(sequelize: Sequelize): void {
  AiRequestModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      task: { type: DataTypes.STRING(20), allowNull: false },
      model: { type: DataTypes.STRING(60), allowNull: false },
      promptVersion: { type: DataTypes.STRING(30), allowNull: false },
      latencyMs: { type: DataTypes.INTEGER, allowNull: false },
      schemaValid: { type: DataTypes.BOOLEAN, allowNull: false },
      retryCount: { type: DataTypes.INTEGER, allowNull: false },
      violations: { type: DataTypes.TEXT, allowNull: false },
      usedFallback: { type: DataTypes.BOOLEAN, allowNull: false },
      outputTokens: { type: DataTypes.INTEGER, allowNull: true },
      error: { type: DataTypes.STRING(300), allowNull: true },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: 'ai_requests', underscored: true, updatedAt: false },
  );
  NutritionDayModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      source: { type: DataTypes.STRING(10), allowNull: false },
      data: { type: DataTypes.TEXT, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: 'nutrition_days', underscored: true },
  );
}
