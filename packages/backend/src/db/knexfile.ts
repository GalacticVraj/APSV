import type { Knex } from 'knex';

// knexfile.ts used by knex CLI for migrations and seeds
const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'carbonloop',
    user: process.env.DB_USER || 'carbonloop_user',
    password: process.env.DB_PASSWORD || '',
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './seeds',
    extension: 'ts',
  },
};

module.exports = config;
