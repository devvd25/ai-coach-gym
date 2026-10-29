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

export class WorkoutLogModel extends Model<
  InferAttributes<WorkoutLogModel>,
  InferCreationAttributes<WorkoutLogModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare sessionId: number | null;
  declare title: string;
  declare startedAt: Date;
  declare finishedAt: Date;
  declare notes: string;
  declare feeling: string | null;
  declare sets?: NonAttribute<WorkoutSetModel[]>;
}

export class WorkoutSetModel extends Model<
  InferAttributes<WorkoutSetModel>,
  InferCreationAttributes<WorkoutSetModel>
> {
  declare id: CreationOptional<number>;
  declare workoutId: ForeignKey<WorkoutLogModel['id']>;
  declare exerciseId: number;
  declare setNumber: number;
  declare reps: number;
  declare weightKg: number | null;
  declare rpe: number | null;
  declare exercise?: NonAttribute<ExerciseModel>;
}

export class WeightLogModel extends Model<
  InferAttributes<WeightLogModel>,
  InferCreationAttributes<WeightLogModel>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  /** YYYY-MM-DD. */
  declare date: string;
  declare weightKg: number;
  declare note: string;
}

export function initWorkoutModels(sequelize: Sequelize): void {
  WorkoutLogModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      sessionId: { type: DataTypes.INTEGER, allowNull: true },
      title: { type: DataTypes.STRING(60), allowNull: false },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      finishedAt: { type: DataTypes.DATE, allowNull: false },
      notes: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
      feeling: { type: DataTypes.STRING(10), allowNull: true },
    },
    { sequelize, tableName: 'workout_logs', underscored: true },
  );
  WorkoutSetModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      exerciseId: { type: DataTypes.INTEGER, allowNull: false },
      setNumber: { type: DataTypes.INTEGER, allowNull: false },
      reps: { type: DataTypes.INTEGER, allowNull: false },
      weightKg: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
      rpe: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
    },
    { sequelize, tableName: 'workout_sets', underscored: true, timestamps: false },
  );
  WeightLogModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      weightKg: { type: DataTypes.DECIMAL(5, 1), allowNull: false },
      note: { type: DataTypes.STRING(120), allowNull: false, defaultValue: '' },
    },
    { sequelize, tableName: 'weight_logs', underscored: true },
  );

  WorkoutLogModel.hasMany(WorkoutSetModel, { as: 'sets', foreignKey: 'workoutId' });
  WorkoutSetModel.belongsTo(ExerciseModel, { as: 'exercise', foreignKey: 'exerciseId' });
}
