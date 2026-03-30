import pg from "pg";
import { DATABASE_URL, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, POSTGRES_CA_CERT } from "../envs";
import logger from "../logger/winston.logger";

async function setupPostgres() {
  const connectionString = DATABASE_URL;
  const caCert = POSTGRES_CA_CERT;

  const config: any = {
    connectionString,
  };

  if (caCert) {
    config.ssl = {
      rejectUnauthorized: true,
      ca: caCert,
    };
  }

  if (!connectionString) {
    config.user = DB_USER;
    config.host = DB_HOST;
    config.database = DB_NAME;
    config.password = DB_PASSWORD;
    config.port = parseInt(DB_PORT, 10);
  }

  const client = new pg.Client(config);
  await client.connect();

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
    await client.query(createProjectsTable);
    logger.info("✅ Projects table is ready.");
    await client.query(createDeploymentsTable);
    logger.info("✅ Deployments table is ready.");
  } catch (error) {
    logger.error("❌ PostgreSQL setup failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("👋 Database connection closed.");
  }
}

setupPostgres().then(() => {
  process.exit(0);
});
