import { clickHouseService } from "../services/clickhouse.services";
import logger from "../logger/winston.logger";

async function resetClickHouse() {
  logger.info("🗑️ Resetting ClickHouse...");

  try {
    await clickHouseService.exec("DROP TABLE IF EXISTS log_events");
    logger.info("✅ ClickHouse log_events table deleted.");
  } catch (error) {
    logger.error("❌ ClickHouse reset failed:", error);
    process.exit(1);
  } finally {
    await clickHouseService.close();
  }
}

resetClickHouse().then(() => {
  process.exit(0);
});
