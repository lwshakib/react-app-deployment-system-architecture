import { postgresService } from "../services/postgres.services";
import logger from "../logger/winston.logger";

async function resetPostgres() {
  logger.info("🗑️ Resetting Postgres database...");

  const resetQuery = `
    DROP TABLE IF EXISTS deployments CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
  `;

  try {
    await postgresService.query(resetQuery);
    logger.info("✅ Postgres tables dropped successfully.");
  } catch (error) {
    logger.error("❌ Postgres reset failed:", error);
    process.exit(1);
  } finally {
    await postgresService.close();
  }
}

resetPostgres().then(() => {
  process.exit(0);
});
