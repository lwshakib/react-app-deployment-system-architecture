import { clickHouseService } from "../services/clickhouse.service";

async function resetClickHouse() {
  console.log("🔥 Resetting ClickHouse database...");

  const dropTableQuery = "DROP TABLE IF EXISTS log_events";

  try {
    await clickHouseService.exec(dropTableQuery);
    console.log("✅ ClickHouse log_events table dropped successfully.");
  } catch (error) {
    console.error("❌ ClickHouse reset failed:", error);
    process.exit(1);
  } finally {
    await clickHouseService.close();
  }
}

resetClickHouse();
