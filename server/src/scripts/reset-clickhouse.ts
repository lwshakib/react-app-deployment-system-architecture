import { createClient } from "@clickhouse/client";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "../envs";
import logger from "../logger/winston.logger";

const client = createClient({
  url: CLICKHOUSE_URL,
  username: CLICKHOUSE_USER,
  password: CLICKHOUSE_PASSWORD,
  database: CLICKHOUSE_DB,
});

async function resetClickHouse() {
  logger.info("🗑️ Resetting ClickHouse...");

  try {
    await client.exec({ query: "DROP TABLE IF EXISTS log_events" });
    logger.info("✅ ClickHouse log_events table deleted.");
  } catch (error) {
    logger.error("❌ ClickHouse reset failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

resetClickHouse().then(() => {
  process.exit(0);
});
