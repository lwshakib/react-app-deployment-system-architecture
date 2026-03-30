/**
 * Kafka Service Module.
 * This service manages the connection to Kafka and provides methods to stream 
 * build logs and deployment status updates to the main orchestration server.
 */

import { Kafka, type Producer } from "kafkajs";
import fs from "fs";
import path from "path";

// Import centralized logger and environment variables
import logger from "../logger/winston.logger.js";
import { 
  DEPLOYMENT_ID, 
  KAFKA_BROKER, 
  KAFKA_CA_CERT, 
  KAFKA_PASSWORD, 
  KAFKA_USERNAME, 
  PROJECT_ID 
} from "../envs";

class KafkaService {
  // The Kafka client instance
  private kafka: Kafka;
  // The Producer instance used for sending messages
  private producer: Producer;
  // Metadata to identify which project/deployment the logs belong to
  private projectId: string;
  private deploymentId: string;

  /**
   * Initializes the Kafka client with SASL/SSL credentials.
   */
  constructor() {
    this.projectId = PROJECT_ID;
    this.deploymentId = DEPLOYMENT_ID;
    
    this.kafka = new Kafka({
      // Unique client ID based on the deployment execution
      clientId: `docker-build-server-${this.deploymentId}`,
      // Array of broker addresses (usually just one for the seed broker)
      brokers: [KAFKA_BROKER],
      // SSL configuration (uses CA certificate if provided in envs)
      ssl: KAFKA_CA_CERT ? {
        ca: [KAFKA_CA_CERT],
      } : undefined,
      // Authentication using SASL PLAIN mechanism
      sasl: {
        username: KAFKA_USERNAME,
        password: KAFKA_PASSWORD,
        mechanism: "plain",
      },
      // Retry policy for connection attempts
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });

    // Create the producer instance
    this.producer = this.kafka.producer();
  }

  /**
   * Establishes a connection to the Kafka cluster.
   */
  async connect() {
    try {
      await this.producer.connect();
      logger.info("✅ Kafka Producer connected");
    } catch (err) {
      logger.error("❌ Kafka Connection Error:", err);
      // Fail fast if we can't connect, as logs are critical for observability
      throw err;
    }
  }

  /**
   * Gracefully disconnects from the Kafka cluster.
   */
  async disconnect() {
    try {
      await this.producer.disconnect();
      logger.info("✅ Kafka Producer disconnected");
    } catch (err) {
      logger.error("❌ Error disconnecting Kafka Producer:", err);
    }
  }

  /**
   * Publishes a real-time build log statement to the 'container-logs' topic.
   * @param log - The text message to send
   */
  async publishLog(log: string) {
    // Also print to local console for container log visibility
    logger.debug(`📤 Log: ${log}`);
    try {
      await this.producer.send({
        topic: "container-logs",
        messages: [
          {
            key: "log", // Use a static key for routing if needed
            value: JSON.stringify({ 
              PROJECT_ID: this.projectId, 
              DEPLOYMENT_ID: this.deploymentId, 
              log 
            }),
          },
        ],
      });
    } catch (err) {
      // If Kafka fails, we log locally but don't crash the build
      logger.error("❌ Failed to publish log to Kafka:", err);
    }
  }

  /**
   * Updates the final deployment status in the 'deployment-status' topic.
   * @param status - The final state of the build ('READY' or 'FAILED')
   */
  async publishStatus(status: "READY" | "FAILED") {
    logger.info(`📡 Publishing final status: ${status}`);
    try {
      await this.producer.send({
        topic: "deployment-status",
        messages: [
          {
            key: "status",
            value: JSON.stringify({ 
              PROJECT_ID: this.projectId, 
              DEPLOYMENT_ID: this.deploymentId, 
              status 
            }),
          },
        ],
      });
    } catch (err) {
      logger.error(`❌ Failed to publish ${status} status to Kafka:`, err);
    }
  }
}

// Export a singleton instance of the KafkaService
export const kafkaService = new KafkaService();
