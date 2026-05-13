/**
 * PostgreSQL Database Service.
 * This module manages a connection pool to the database, supporting both 
 * connection strings and individual parameter configurations with SSL/TLS support.
 */

import { Pool, PoolConfig } from 'pg';
import logger from "../logger/winston.logger.js";
import { 
  DATABASE_URL, 
  DB_HOST, 
  DB_NAME, 
  DB_PASSWORD, 
  DB_PORT, 
  DB_USER, 
  POSTGRES_CA_CERT 
} from '../envs';

class PostgresService {
  // Shared connection pool instance
  private pool: Pool;

  /**
   * Initializes the database connection pool using environment configuration.
   */
  constructor() {
    // Attempt to get the full connection string
    const connectionString = DATABASE_URL;
    // Extract CA certificate for secure SSL connections
    const caCert = POSTGRES_CA_CERT;

    // Initial pool configuration using the connection string
    const config: PoolConfig = {
      connectionString,
    };

    // If a CA certificate is provided, enable SSL and enforce validation
    if (caCert) {
      config.ssl = {
        rejectUnauthorized: true,
        ca: caCert,
      };
      logger.info('🔒 Postgres SSL CA certificate loaded from environment.');
    }

    // Fallback: If no connection string is provided, construct config from individual fields
    if (!connectionString) {
      const user = DB_USER;
      const host = DB_HOST;
      const database = DB_NAME;
      const password = DB_PASSWORD;
      const portStr = DB_PORT;

      // Ensure all required fields are present if omitting the connection string
      if (!user || !host || !database || !password || !portStr) {
        throw new Error("❌ PostgreSQL environment variables (DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT) are missing and no DATABASE_URL was provided.");
      }

      config.user = user;
      config.host = host;
      config.database = database;
      config.password = password;
      config.port = parseInt(portStr, 10);
    }

    // Initialize the pg Pool with the final configuration
    this.pool = new Pool(config);

    // Error handler for established idle clients in the pool
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
      // Hard exit as database connectivity is critical for the reverse proxy
      process.exit(-1);
    });
  }

  /**
   * Executes a SQL query against the database.
   * @param text - The SQL query string
   * @param params - Optional parameters for the query
   * @returns The Result object from pg
   */
  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      // Log query execution for performance auditing
      logger.info('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      // Log specific database errors
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

// Export a singleton instance of the PostgresService
export const postgresService = new PostgresService();
export default postgresService;
