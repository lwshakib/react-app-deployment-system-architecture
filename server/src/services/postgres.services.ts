/**
 * PostgreSQL Database Service.
 * Manages the connection pool for the main relational database,
 * which stores project metadata, subdomains, and deployment records.
 */

import { Pool, PoolConfig } from 'pg';
import logger from "../logger/winston.logger";
import { DATABASE_URL, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, POSTGRES_CA_CERT } from "../envs";

class PostgresService {
  // Shared connection pool for efficient resource management
  private pool: Pool;

  /**
   * Initializes the database connection pool using either a full URI 
   * or individual parameters, with support for SSL/TLS.
   */
  constructor() {
    const connectionString = DATABASE_URL;
    const caCert = POSTGRES_CA_CERT;

    const config: PoolConfig = {
      connectionString,
    };

    // --- SSL CONFIGURATION ---
    if (caCert) {
      // Inject the CA certificate string directly for secure cloud connections
      config.ssl = {
        rejectUnauthorized: true,
        ca: caCert,
      };
      logger.info(`🔒 Postgres SSL CA certificate loaded from environment.`);
    }

    // --- FALLBACK TO INDIVIDUAL PARAMS ---
    if (!connectionString) {
      const user = DB_USER;
      const host = DB_HOST;
      const database = DB_NAME;
      const password = DB_PASSWORD;
      const portStr = DB_PORT;

      // Ensure all required individual parameters are present if no URI is provided
      if (!user || !host || !database || !password || !portStr) {
        throw new Error("❌ PostgreSQL environment variables are missing and no DATABASE_URL was provided.");
      }

      config.user = user;
      config.host = host;
      config.database = database;
      config.password = password;
      config.port = parseInt(portStr, 10);
    }

    // Initialize the pool
    this.pool = new Pool(config);

    // Global error listener for the pool to handle unexpected connection drops
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
      // Hard exit on fatal DB error to allow container orchestrator to restart
      process.exit(-1);
    });
  }

  /**
   * Execute a SQL query using a client from the pool.
   * @param text - The SQL query string
   * @param params - Optional parameter array for the query
   * @returns The result of the query
   */
  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      // Automatic checkout/release from the pool
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      // Log query execution time for performance monitoring
      logger.info('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Database query error', error);
      throw error;
    }
  }

  /**
   * Gracefully shuts down the connection pool.
   */
  async close() {
    await this.pool.end();
    logger.info("👋 Postgres disconnected");
  }
}

// Export a singleton instance for application-wide use
export const postgresService = new PostgresService();
export default postgresService;
