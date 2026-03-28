import { Pool, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

class PostgresService {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const caFile = process.env.POSTGRES_CA_FILE;

    const config: PoolConfig = {
      connectionString,
    };

    if (caFile) {
      try {
        const caPath = path.isAbsolute(caFile) ? caFile : path.join(process.cwd(), caFile);
        const ca = fs.readFileSync(caPath, 'utf8');
        config.ssl = {
          rejectUnauthorized: true,
          ca,
        };
        console.log('🔒 Postgres SSL CA certificate loaded from:', caPath);
      } catch (error) {
        console.error('❌ Failed to load Postgres CA certificate:', error);
      }
    }

    if (!connectionString) {
      const user = process.env.DB_USER;
      const host = process.env.DB_HOST;
      const database = process.env.DB_NAME;
      const password = process.env.DB_PASSWORD;
      const portStr = process.env.DB_PORT;

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

    // Add secure defaults for pool behavior
    // These apply regardless of connection method if passed in the object,
    // but the pool constructor handles the logic.
    // To be safe, we can extend the config if needed.

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      process.exit(-1);
    });
  }

  /**
   * Execute a database query
   * @param text SQL query string
   * @param params Query parameters
   */
  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error', error);
      throw error;
    }
  }

  /**
   * Close the pool
   */
  async close() {
    await this.pool.end();
  }
}

// Export a singleton instance
export const postgresService = new PostgresService();
export default postgresService;
