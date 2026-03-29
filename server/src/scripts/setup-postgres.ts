import { postgresService } from "../services/postgres.service";

async function setupDatabase() {
  console.log("🚀 Starting database setup...");

  const createTablesQuery = `
    DROP TABLE IF EXISTS deployments;
    DROP TABLE IF EXISTS projects;

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      git_url TEXT NOT NULL,
      sub_domain VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await postgresService.query(createTablesQuery);
    console.log("✅ Deployments table is ready.");
    
    // Check if table is empty, maybe add a dummy record?
    const checkQuery = "SELECT COUNT(*) FROM deployments";
    const res = await postgresService.query(checkQuery);
    console.log(`📊 Current deployment count: ${res.rows[0].count}`);

  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  } finally {
    await postgresService.close();
    console.log("👋 Database connection closed.");
  }
}

setupDatabase().then(() => {
  process.exit(0);
});
