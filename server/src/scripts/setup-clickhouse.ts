import { clickHouseService } from "../services/clickhouse.services";
import logger from "../logger/winston.logger";

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
    await clickHouseService.exec("CREATE DATABASE IF NOT EXISTS analytics");
    await clickHouseService.exec(createTableQuery);
    logger.info("✅ ClickHouse log_events table is ready.");
  } catch (error) {
    logger.error("❌ ClickHouse setup failed:", error);
    process.exit(1);
  } finally {
    await clickHouseService.close();
  }
}

setupClickHouse().then(() => {
  process.exit(0);
});
