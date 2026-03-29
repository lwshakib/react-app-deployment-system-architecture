import { postgresService } from "../services/postgres.services";
import logger from "../logger/winston.logger";

async function setupPostgres() {
  logger.info("🚀 Starting PostgreSQL setup...");

  const createProjectsTable = `
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      git_url TEXT NOT NULL,
      sub_domain TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createDeploymentsTable = `
    CREATE TABLE IF NOT EXISTS deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await postgresService.query(createProjectsTable);
    logger.info("✅ Projects table is ready.");
    await postgresService.query(createDeploymentsTable);
    logger.info("✅ Deployments table is ready.");
  } catch (error) {
    logger.error("❌ PostgreSQL setup failed:", error);
    process.exit(1);
  } finally {
    await postgresService.close();
    console.log("👋 Database connection closed.");
  }
}

setupPostgres().then(() => {
  process.exit(0);
});
