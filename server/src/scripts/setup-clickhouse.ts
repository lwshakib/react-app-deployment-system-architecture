import { createClient } from "@clickhouse/client";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "../envs";
import logger from "../logger/winston.logger";

const url = CLICKHOUSE_URL;
const username = CLICKHOUSE_USER;
const password = CLICKHOUSE_PASSWORD;
const database = CLICKHOUSE_DB;

const client = createClient({
  url,
  username,
  password,
  database,
});

async function setupClickHouse() {
  logger.info("🚀 Starting ClickHouse setup...");

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
    await client.exec({ query: "CREATE DATABASE IF NOT EXISTS analytics" });
    await client.exec({ query: createTableQuery });
    logger.info("✅ ClickHouse log_events table is ready.");
  } catch (error) {
    logger.error("❌ ClickHouse setup failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupClickHouse().then(() => {
  process.exit(0);
});
