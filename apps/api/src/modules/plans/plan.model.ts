import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';
import { ExerciseModel } from '../exercises/exercise.model.js';

export class PlanModel extends Model<
  InferAttributes<PlanModel>,
  InferCreationAttributes<PlanModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  /** YYYY-MM-DD (Monday). */
  declare weekStart: string;
  declare source: CreationOptional<string>;
  /** Why the AI proposed this plan; null for manual plans. */
  declare aiNote: CreationOptional<string | null>;
  declare sessions?: NonAttribute<PlanSessionModel[]>;
}

export class PlanSessionModel extends Model<
  InferAttributes<PlanSessionModel>,
  InferCreationAttributes<PlanSessionModel>
> {
  declare id: CreationOptional<number>;
  declare planId: ForeignKey<PlanModel['id']>;
  declare day: string;
  declare title: string;
  declare durationMin: number;
  declare notes: string;
  declare completedAt: CreationOptional<Date | null>;
  declare items?: NonAttribute<PlanSessionExerciseModel[]>;
  declare plan?: NonAttribute<PlanModel>;
}

export class PlanSessionExerciseModel extends Model<
  InferAttributes<PlanSessionExerciseModel>,
  InferCreationAttributes<PlanSessionExerciseModel>
> {
  declare id: CreationOptional<number>;
  declare sessionId: ForeignKey<PlanSessionModel['id']>;
  declare exerciseId: number;
  declare position: number;
  declare sets: number;
  declare reps: string;
  declare weightKg: number | null;
  declare restSeconds: number;
  declare exercise?: NonAttribute<ExerciseModel>;
}

export function initPlanModels(sequelize: Sequelize): void {
  PlanModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      weekStart: { type: DataTypes.DATEONLY, allowNull: false },
      source: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'manual' },
      aiNote: { type: DataTypes.STRING(1000), allowNull: true },
    },
    { sequelize, tableName: 'plans', underscored: true },
  );
  PlanSessionModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      day: { type: DataTypes.STRING(3), allowNull: false },
      title: { type: DataTypes.STRING(60), allowNull: false },
      durationMin: { type: DataTypes.INTEGER, allowNull: false },
      notes: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
      completedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'plan_sessions', underscored: true },
  );
  PlanSessionExerciseModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      exerciseId: { type: DataTypes.INTEGER, allowNull: false },
      position: { type: DataTypes.INTEGER, allowNull: false },
      sets: { type: DataTypes.INTEGER, allowNull: false },
      reps: { type: DataTypes.STRING(10), allowNull: false },
      weightKg: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
      restSeconds: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: 'plan_session_exercises', underscored: true, timestamps: false },
  );

  PlanModel.hasMany(PlanSessionModel, { as: 'sessions', foreignKey: 'planId' });
  PlanSessionModel.belongsTo(PlanModel, { as: 'plan', foreignKey: 'planId' });
  PlanSessionModel.hasMany(PlanSessionExerciseModel, { as: 'items', foreignKey: 'sessionId' });
  PlanSessionExerciseModel.belongsTo(ExerciseModel, { as: 'exercise', foreignKey: 'exerciseId' });
}
