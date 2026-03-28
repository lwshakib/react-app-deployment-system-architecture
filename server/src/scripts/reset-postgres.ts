import { postgresService } from "../services/postgres.service";

async function resetPostgres() {
  console.log("🔥 Resetting Postgres database...");

  const resetQuery = `
    DROP TABLE IF EXISTS deployments CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
  `;

  try {
    await postgresService.query(resetQuery);
    console.log("✅ Postgres tables dropped successfully.");
  } catch (error) {
    console.error("❌ Postgres reset failed:", error);
    process.exit(1);
  } finally {
    await postgresService.close();
  }
}

resetPostgres();
