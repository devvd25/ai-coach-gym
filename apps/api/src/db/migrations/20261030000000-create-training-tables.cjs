'use strict';

const timestamps = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('SYSDATETIMEOFFSET()'),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('SYSDATETIMEOFFSET()'),
  },
});

// SQL Server rejects multiple cascade paths, so only the ownership chain
// users → plans → plan_sessions → plan_session_exercises (and users → workout_logs → workout_sets)
// cascades. Links to exercises and to plan_sessions from workout_logs are NO ACTION and handled in code.
module.exports = {
  async up(queryInterface, Sequelize) {
    const id = { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true };

    await queryInterface.createTable('exercises', {
      id,
      slug: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      muscle_group: { type: Sequelize.STRING(20), allowNull: false },
      secondary_muscles: { type: Sequelize.STRING(120), allowNull: false, defaultValue: '' },
      equipment: { type: Sequelize.STRING(20), allowNull: false },
      level: { type: Sequelize.STRING(20), allowNull: false },
      description: { type: Sequelize.STRING(400), allowNull: false },
      steps: { type: Sequelize.TEXT, allowNull: false },
      mistakes: { type: Sequelize.TEXT, allowNull: false },
      camera_supported: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      default_sets: { type: Sequelize.INTEGER, allowNull: false },
      default_reps: { type: Sequelize.STRING(10), allowNull: false },
      rest_seconds: { type: Sequelize.INTEGER, allowNull: false },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('plans', {
      id,
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      week_start: { type: Sequelize.DATEONLY, allowNull: false },
      source: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'manual' },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('plans', ['user_id', 'week_start'], { unique: true });

    await queryInterface.createTable('plan_sessions', {
      id,
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
        onDelete: 'CASCADE',
      },
      day: { type: Sequelize.STRING(3), allowNull: false },
      title: { type: Sequelize.STRING(60), allowNull: false },
      duration_min: { type: Sequelize.INTEGER, allowNull: false },
      notes: { type: Sequelize.STRING(300), allowNull: false, defaultValue: '' },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('plan_session_exercises', {
      id,
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'plan_sessions', key: 'id' },
        onDelete: 'CASCADE',
      },
      exercise_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'exercises', key: 'id' },
      },
      position: { type: Sequelize.INTEGER, allowNull: false },
      sets: { type: Sequelize.INTEGER, allowNull: false },
      reps: { type: Sequelize.STRING(10), allowNull: false },
      weight_kg: { type: Sequelize.DECIMAL(5, 1), allowNull: true },
      rest_seconds: { type: Sequelize.INTEGER, allowNull: false },
    });

    await queryInterface.createTable('workout_logs', {
      id,
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'plan_sessions', key: 'id' },
      },
      title: { type: Sequelize.STRING(60), allowNull: false },
      started_at: { type: Sequelize.DATE, allowNull: false },
      finished_at: { type: Sequelize.DATE, allowNull: false },
      notes: { type: Sequelize.STRING(500), allowNull: false, defaultValue: '' },
      feeling: { type: Sequelize.STRING(10), allowNull: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('workout_logs', ['user_id', 'started_at']);

    await queryInterface.createTable('workout_sets', {
      id,
      workout_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'workout_logs', key: 'id' },
        onDelete: 'CASCADE',
      },
      exercise_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'exercises', key: 'id' },
      },
      set_number: { type: Sequelize.INTEGER, allowNull: false },
      reps: { type: Sequelize.INTEGER, allowNull: false },
      weight_kg: { type: Sequelize.DECIMAL(5, 1), allowNull: true },
      rpe: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
    });

    await queryInterface.createTable('weight_logs', {
      id,
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      weight_kg: { type: Sequelize.DECIMAL(5, 1), allowNull: false },
      note: { type: Sequelize.STRING(120), allowNull: false, defaultValue: '' },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('weight_logs', ['user_id', 'date'], { unique: true });
  },

  async down(queryInterface) {
    for (const t of [
      'weight_logs',
      'workout_sets',
      'workout_logs',
      'plan_session_exercises',
      'plan_sessions',
      'plans',
      'exercises',
    ]) {
      await queryInterface.dropTable(t);
    }
  },
};
