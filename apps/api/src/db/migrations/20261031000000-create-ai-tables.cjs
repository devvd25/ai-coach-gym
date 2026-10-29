'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plans', 'ai_note', {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });

    // One row per AI call: the data set for the LLM experiments (latency, validity, fallbacks).
    await queryInterface.createTable('ai_requests', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      task: { type: Sequelize.STRING(20), allowNull: false },
      model: { type: Sequelize.STRING(60), allowNull: false },
      prompt_version: { type: Sequelize.STRING(30), allowNull: false },
      latency_ms: { type: Sequelize.INTEGER, allowNull: false },
      schema_valid: { type: Sequelize.BOOLEAN, allowNull: false },
      retry_count: { type: Sequelize.INTEGER, allowNull: false },
      violations: { type: Sequelize.TEXT, allowNull: false, defaultValue: '[]' },
      used_fallback: { type: Sequelize.BOOLEAN, allowNull: false },
      output_tokens: { type: Sequelize.INTEGER, allowNull: true },
      error: { type: Sequelize.STRING(300), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('SYSDATETIMEOFFSET()'),
      },
    });
    await queryInterface.addIndex('ai_requests', ['user_id', 'created_at']);

    await queryInterface.createTable('nutrition_days', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      source: { type: Sequelize.STRING(10), allowNull: false },
      // { targets, meals, explanation } as JSON text.
      data: { type: Sequelize.TEXT, allowNull: false },
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
    await queryInterface.addIndex('nutrition_days', ['user_id', 'date'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nutrition_days');
    await queryInterface.dropTable('ai_requests');
    await queryInterface.removeColumn('plans', 'ai_note');
  },
};
