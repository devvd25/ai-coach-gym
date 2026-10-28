import type { Sequelize } from 'sequelize';
import { initProfileModel } from '../modules/profile/profile.model.js';
import { initUserModel } from '../modules/users/user.model.js';

export function initModels(sequelize: Sequelize): void {
  initUserModel(sequelize);
  initProfileModel(sequelize);
}
