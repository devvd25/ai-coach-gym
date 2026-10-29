import type { Sequelize } from 'sequelize';
import { initExerciseModel } from '../modules/exercises/exercise.model.js';
import { initPlanModels } from '../modules/plans/plan.model.js';
import { initProfileModel } from '../modules/profile/profile.model.js';
import { initUserModel } from '../modules/users/user.model.js';
import { initWorkoutModels } from '../modules/workouts/workout.model.js';

export function initModels(sequelize: Sequelize): void {
  initUserModel(sequelize);
  initProfileModel(sequelize);
  initExerciseModel(sequelize);
  initPlanModels(sequelize);
  initWorkoutModels(sequelize);
}
