import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class ExerciseModel extends Model<
  InferAttributes<ExerciseModel>,
  InferCreationAttributes<ExerciseModel>
> {
  declare id: CreationOptional<number>;
  declare slug: string;
  declare name: string;
  declare muscleGroup: string;
  declare secondaryMuscles: string;
  declare equipment: string;
  declare level: string;
  declare description: string;
  /** JSON array of strings. */
  declare steps: string;
  /** JSON array of strings. */
  declare mistakes: string;
  declare cameraSupported: boolean;
  declare defaultSets: number;
  declare defaultReps: string;
  declare restSeconds: number;
}

export function initExerciseModel(sequelize: Sequelize): void {
  ExerciseModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      muscleGroup: { type: DataTypes.STRING(20), allowNull: false },
      secondaryMuscles: { type: DataTypes.STRING(120), allowNull: false },
      equipment: { type: DataTypes.STRING(20), allowNull: false },
      level: { type: DataTypes.STRING(20), allowNull: false },
      description: { type: DataTypes.STRING(400), allowNull: false },
      steps: { type: DataTypes.TEXT, allowNull: false },
      mistakes: { type: DataTypes.TEXT, allowNull: false },
      cameraSupported: { type: DataTypes.BOOLEAN, allowNull: false },
      defaultSets: { type: DataTypes.INTEGER, allowNull: false },
      defaultReps: { type: DataTypes.STRING(10), allowNull: false },
      restSeconds: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, tableName: 'exercises', underscored: true },
  );
}
