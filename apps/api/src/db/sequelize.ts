import { Sequelize } from 'sequelize';
import type { Env } from '../config/env.js';

export function createSequelize(env: Env): Sequelize {
  return new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
    host: env.DB_HOST,
    port: env.DB_PORT,
    dialect: 'mssql',
    dialectOptions: {
      // Local Docker SQL Server uses a self-signed certificate.
      options: { encrypt: true, trustServerCertificate: env.NODE_ENV !== 'production' },
    },
    define: { underscored: true },
    pool: { max: 10, min: 0, idle: 10_000 },
    logging: false,
  });
}
