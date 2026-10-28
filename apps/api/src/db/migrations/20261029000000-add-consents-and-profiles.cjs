'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'consent_camera', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'consent_research', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.createTable('profiles', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      goal: { type: Sequelize.STRING(20), allowNull: false },
      sex: { type: Sequelize.STRING(10), allowNull: false },
      age: { type: Sequelize.INTEGER, allowNull: false },
      height_cm: { type: Sequelize.DECIMAL(5, 1), allowNull: false },
      weight_kg: { type: Sequelize.DECIMAL(5, 1), allowNull: false },
      level: { type: Sequelize.STRING(20), allowNull: false },
      injuries: { type: Sequelize.STRING(500), allowNull: false, defaultValue: '' },
      sessions_per_week: { type: Sequelize.INTEGER, allowNull: false },
      session_minutes: { type: Sequelize.INTEGER, allowNull: false },
      // JSON arrays stored as NVARCHAR text, e.g. ["mon","wed"].
      preferred_days: { type: Sequelize.STRING(100), allowNull: false, defaultValue: '[]' },
      location: { type: Sequelize.STRING(10), allowNull: false },
      equipment: { type: Sequelize.STRING(200), allowNull: false, defaultValue: '[]' },
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('profiles');
    await queryInterface.removeColumn('users', 'consent_research');
    await queryInterface.removeColumn('users', 'consent_camera');
  },
};
