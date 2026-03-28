import { Pool } from 'pg';

class PostgresService {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    
    this.pool = new Pool(connectionString ? { connectionString } : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });

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
