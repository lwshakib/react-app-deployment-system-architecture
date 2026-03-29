import { createClient, ClickHouseClient } from "@clickhouse/client";
import logger from "../logger/winston.logger";

class ClickHouseService {
  private client: ClickHouseClient;

  constructor() {
    const url = process.env.CLICKHOUSE_URL;
    const username = process.env.CLICKHOUSE_USER;
    const password = process.env.CLICKHOUSE_PASSWORD;
    const database = process.env.CLICKHOUSE_DB;

    if (!url || !username || !database) {
      throw new Error("❌ ClickHouse environment variables (CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_DB) are missing.");
    }

    this.client = createClient({
      url,
      username,
      password: password || undefined,
      database,
    });
  }

  /**
   * Execute a query on ClickHouse
   */
  async query(query: string, query_params: Record<string, any>) {
    try {
      const resultSet = await this.client.query({
        query,
        query_params,
        format: "JSONEachRow",
      });
      return await resultSet.json();
    } catch (error) {
      logger.error("❌ ClickHouse query error:", error);
      throw error;
    }
  }

  /**
   * Execute a command (e.g., DDL) on ClickHouse
   */
  async exec(query: string) {
    try {
      await this.client.exec({ query });
      logger.info("✅ ClickHouse command executed successfully");
    } catch (error) {
      logger.error("❌ ClickHouse exec error:", error);
      throw error;
    }
  }

  /**
   * Insert data into a table
   */
  async insert(table: string, values: any[]) {
    try {
      return await this.client.insert({
        table,
        values,
        format: "JSONEachRow",
      });
    } catch (error) {
      logger.error(`❌ ClickHouse insert error into ${table}:`, error);
      throw error;
    }
  }

  /**
   * Close the client connection
   */
  async close() {
    await this.client.close();
    logger.info("👋 ClickHouse disconnected");
  }
}

// Export a singleton instance
export const clickHouseService = new ClickHouseService();
export default clickHouseService;
