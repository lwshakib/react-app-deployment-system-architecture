/**
 * ClickHouse Analytics Reset Script.
 * This script automates the deletion of the 'log_events' table to clear all 
 * build-time logs and ensure a clean environment for the analytics engine.
 */

import { createClient } from "@clickhouse/client";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "../envs";
import logger from "../logger/winston.logger";

/**
 * Global ClickHouse Client Configuration.
 */
const client = createClient({
  url: CLICKHOUSE_URL,
  username: CLICKHOUSE_USER,
  password: CLICKHOUSE_PASSWORD,
  database: CLICKHOUSE_DB,
});

/**
 * Main Reset function for ClickHouse.
 */
async function resetClickHouse() {
  logger.info("🗑️ Resetting ClickHouse...");

  try {
    // 1. Drop the log_events table if it exists
    await client.exec({ query: "DROP TABLE IF EXISTS log_events" });
    
    logger.info("✅ ClickHouse log_events table deleted.");
  } catch (error) {
    logger.error("❌ ClickHouse reset failed:", error);
    process.exit(1);
  } finally {
    // 2. Gracefully close the client connection
    await client.close();
  }
}

resetClickHouse().then(() => {
  process.exit(0);
});
