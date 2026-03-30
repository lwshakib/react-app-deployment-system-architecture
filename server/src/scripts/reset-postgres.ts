import pg from "pg";
import { DATABASE_URL, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, POSTGRES_CA_CERT } from "../envs";
import logger from "../logger/winston.logger";

async function resetPostgres() {
  logger.info("🗑️ Resetting Postgres database...");

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

  const resetQuery = `
    DROP TABLE IF EXISTS deployments CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
  `;

  try {
    await client.connect();
    await client.query(resetQuery);
    logger.info("✅ Postgres tables dropped successfully.");
  } catch (error) {
    logger.error("❌ Postgres reset failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetPostgres().then(() => {
  process.exit(0);
});
