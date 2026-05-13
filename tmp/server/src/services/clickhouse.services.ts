/**
 * ClickHouse Database Service.
 * This service handles interactions with the ClickHouse database, 
 * primarily used for storing and querying large volumes of build logs.
 */

import { createClient, type ClickHouseClient } from "@clickhouse/client";
import logger from "../logger/winston.logger";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "../envs";

class ClickHouseService {
  // Internal ClickHouse JS client
  private client: ClickHouseClient;

  /**
   * Initializes the ClickHouse client with provided environment credentials.
   */
  constructor() {
    this.client = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USER,
      password: CLICKHOUSE_PASSWORD,
      database: CLICKHOUSE_DB,
    });
  }

  /**
   * Execute a read query on ClickHouse.
   * @param query - The SQL query string
   * @param query_params - Parameter values for the query (security best practice)
   * @returns A promise resolving to the JSON results
   */
  async query(query: string, query_params: Record<string, any>) {
    try {
      const resultSet = await this.client.query({
        query,
        query_params,
        // Using JSONEachRow format for easy integration with frontend
        format: "JSONEachRow",
      });
      return await resultSet.json();
    } catch (error) {
      logger.error("❌ ClickHouse query error:", error);
      throw error;
    }
  }

  /**
   * Execute a command (e.g., DDL like CREATE TABLE) on ClickHouse.
   * @param query - The SQL command to execute
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
   * Bulk insert data into a specific table.
   * @param table - The target table name
   * @param values - An array of objects to insert
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
   * Gracefully close the client connection.
   */
  async close() {
    await this.client.close();
    logger.info("👋 ClickHouse disconnected");
  }
}

// Export a singleton instance for application-wide use
export const clickHouseService = new ClickHouseService();
export default clickHouseService;
