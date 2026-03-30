import { Pool, PoolConfig } from 'pg';
import logger from "../logger/winston.logger.js";
import { DATABASE_URL, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, POSTGRES_CA_CERT } from '../envs.js';

class PostgresService {
  private pool: Pool;

  constructor() {
    const connectionString = DATABASE_URL;
    const caCert = POSTGRES_CA_CERT;

    const config: PoolConfig = {
      connectionString,
    };

    if (caCert) {
      config.ssl = {
        rejectUnauthorized: true,
        ca: caCert,
      };
      logger.info('🔒 Postgres SSL CA certificate loaded from environment.');
    }

    if (!connectionString) {
      const user = DB_USER;
      const host = DB_HOST;
      const database = DB_NAME;
      const password = DB_PASSWORD;
      const portStr = DB_PORT;

      if (!user || !host || !database || !password || !portStr) {
        throw new Error("❌ PostgreSQL environment variables (DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT) are missing and no DATABASE_URL was provided.");
      }

      config.user = user;
      config.host = host;
      config.database = database;
      config.password = password;
      config.port = parseInt(portStr, 10);
    }

    this.pool = new Pool(config);

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
      process.exit(-1);
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.info('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Database query error', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
    logger.info("👋 Postgres disconnected");
  }
}

export const postgresService = new PostgresService();
export default postgresService;
