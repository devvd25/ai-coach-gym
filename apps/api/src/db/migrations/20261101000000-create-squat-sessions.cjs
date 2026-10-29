'use strict';

// One row per camera squat set (M4). Only the counted numbers are stored, no video or landmarks.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('squat_sessions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      started_at: { type: Sequelize.DATE, allowNull: false },
      duration_sec: { type: Sequelize.INTEGER, allowNull: false },
      rep_count: { type: Sequelize.INTEGER, allowNull: false },
      avg_min_knee_angle: { type: Sequelize.DECIMAL(4, 1), allowNull: true },
      model: { type: Sequelize.STRING(10), allowNull: false },
      avg_fps: { type: Sequelize.DECIMAL(5, 1), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('SYSDATETIMEOFFSET()'),
      },
    });
    await queryInterface.addIndex('squat_sessions', ['user_id', 'started_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('squat_sessions');
  },
};
