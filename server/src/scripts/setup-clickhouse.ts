import { clickHouseService } from "../services/clickhouse.service";

async function setupClickHouse() {
  console.log("🚀 Starting ClickHouse setup...");

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
    // Ensure database exists
    await clickHouseService.exec("CREATE DATABASE IF NOT EXISTS analytics");
    
    // Use the new exec method for DDL
    await clickHouseService.exec(createTableQuery);
    console.log("✅ ClickHouse log_events table is ready.");
  } catch (error) {
    console.error("❌ ClickHouse setup failed:", error);
    process.exit(1);
  } finally {
    await clickHouseService.close();
  }
}

setupClickHouse().then(() => {
  process.exit(0);
});
