import { createClient, type ClickHouseClient } from "@clickhouse/client";
import logger from "../logger/winston.logger";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "../envs";

class ClickHouseService {
  private client: ClickHouseClient;

  constructor() {
    this.client = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USER,
      password: CLICKHOUSE_PASSWORD,
      database: CLICKHOUSE_DB,
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
