/**
 * PostgreSQL Database Reset Script.
 * This script automates the deletion of all application tables ('deployments' and 'projects')
 * to ensure a clean state for the database.
 */

import pg from "pg";
import { DATABASE_URL, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, POSTGRES_CA_CERT } from "../envs";
import logger from "../logger/winston.logger";

/**
 * Main Reset function for PostgreSQL.
 */
async function resetPostgres() {
  logger.info("🗑️ Resetting Postgres database...");

  const connectionString = DATABASE_URL;
  const caCert = POSTGRES_CA_CERT;

  // Initialize connection configuration object
  const config: any = {};

  // Priority 1: Use full connection string if provided
  if (connectionString) {
    config.connectionString = connectionString;
  }

  // Priority 2: Use individual parameters as fallback
  if (!connectionString) {
    config.user = DB_USER;
    config.host = DB_HOST;
    config.database = DB_NAME;
    config.password = DB_PASSWORD;
    config.port = parseInt(DB_PORT, 10);
  }

  // Handle SSL configuration for managed services (e.g., Aiven)
  if (caCert) {
    config.ssl = {
      rejectUnauthorized: true,
      ca: caCert,
    };
  }

  // Create and connect the PG client
  const client = new pg.Client(config);

  // Define the reset query: Drop tables with CASCADE to handle foreign key dependencies
  const resetQuery = `
    DROP TABLE IF EXISTS deployments CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
  `;

  try {
    // 1. Establish connection to the database
    await client.connect();
    
    // 2. Execute the drop table commands
    await client.query(resetQuery);
    
    logger.info("✅ Postgres tables dropped successfully.");
  } catch (error) {
    logger.error("❌ Postgres reset failed:", error);
    process.exit(1);
  } finally {
    // 3. Gracefully close the database connection
    await client.end();
  }
}

resetPostgres().then(() => {
  process.exit(0);
});
