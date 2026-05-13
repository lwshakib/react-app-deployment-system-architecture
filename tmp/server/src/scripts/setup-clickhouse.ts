/**
 * ClickHouse Analytics Setup Script.
 * This script initializes the ClickHouse database and creates the 'log_events' table
 * used for storing and querying build-time logs from the deployment containers.
 */

import { createClient } from "@clickhouse/client";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "../envs";
import logger from "../logger/winston.logger";

// Configuration for ClickHouse Client
const url = CLICKHOUSE_URL;
const username = CLICKHOUSE_USER;
const password = CLICKHOUSE_PASSWORD;
const database = CLICKHOUSE_DB;

// Instantiate the ClickHouse client
const client = createClient({
  url,
  username,
  password,
  database,
});

/**
 * Main Setup function for ClickHouse.
 */
async function setupClickHouse() {
  logger.info("🚀 Starting ClickHouse setup...");

  // Schema: log_events table uses MergeTree engine for high-performance analytics
  // Ordered by deployment_id and timestamp for efficient log retrieval per build
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS log_events (
      event_id UUID,
      deployment_id String,
      log String,
      timestamp DateTime64(3) DEFAULT now()
    ) ENGINE = MergeTree()
    ORDER BY (deployment_id, timestamp)
  `;

  try {
    // 1. Ensure the analytics database exists
    await client.exec({ query: `CREATE DATABASE IF NOT EXISTS ${database}` });
    
    // 2. Create the log_events table
    await client.exec({ query: createTableQuery });
    
    logger.info("✅ ClickHouse log_events table is ready.");
  } catch (error) {
    logger.error("❌ ClickHouse setup failed:", error);
    process.exit(1);
  } finally {
    // 3. Gracefully close the client connection
    await client.close();
  }
}

setupClickHouse().then(() => {
  process.exit(0);
});
