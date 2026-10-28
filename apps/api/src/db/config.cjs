// sequelize-cli only loads CommonJS config, so this file mirrors src/config/env.ts for the CLI.
const fs = require('node:fs');
const path = require('node:path');

const rootEnv = path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 1433),
  dialect: 'mssql',
  dialectOptions: {
    options: { encrypt: true, trustServerCertificate: true },
  },
  define: { underscored: true },
  migrationStorageTableName: 'sequelize_meta',
};

module.exports = { development: base, test: base, production: base };
