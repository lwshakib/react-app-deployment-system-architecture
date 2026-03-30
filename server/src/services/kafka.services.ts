/**
 * Kafka Messaging Service.
 * This service handles all interactions with the Kafka cluster, including 
 * producing messages, consuming real-time build logs, and updating deployment statuses.
 */

import { Kafka, Producer, Consumer, Admin } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import logger from "../logger/winston.logger";
import clickHouseService from "./clickhouse.services";
import { KAFKA_BROKER, KAFKA_CA_CERT, KAFKA_CLIENT_ID, KAFKA_PASSWORD, KAFKA_USERNAME } from "../envs";
import postgresService from "./postgres.services";
import eventBus from "./event-bus.services";

class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Consumer[] = [];
  private admin: Admin | null = null;

  /**
   * Initializes the Kafka client with security configurations (SASL/SSL).
   */
  constructor() {
    const broker = KAFKA_BROKER;
    const username = KAFKA_USERNAME;
    const password = KAFKA_PASSWORD;
    const clientId = KAFKA_CLIENT_ID;
    const caCert = KAFKA_CA_CERT;

    // Ensure all critical infrastructure credentials are provided
    if (!broker || !username || !password || !clientId) {
      throw new Error("❌ Kafka environment variables are missing. Infrastructure cannot be initialized.");
    }

    this.kafka = new Kafka({
      clientId,
      brokers: [broker],
      // Inject SSL CA Certificate if provided as a raw string (for cloud deployments)
      ssl: caCert ? { ca: [caCert] } : undefined,
      sasl: {
        mechanism: "plain", // Standard PLAIN authentication
        username,
        password,
      },
    });
  }

  /**
   * Retrieves or initializes the Kafka Admin client for topic management.
   */
  async getAdmin(): Promise<Admin> {
    if (!this.admin) {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      logger.info("✅ Kafka Admin connected");
    }
    return this.admin;
  }

  /**
   * Idempotently creates a Kafka topic.
   * @param topic - The name of the topic to create
   */
  async createTopic(topic: string) {
    try {
      const admin = await this.getAdmin();
      const existingTopics = await admin.listTopics();
      if (existingTopics.includes(topic)) {
        logger.info(`ℹ️ Topic already exists: ${topic}`);
        return;
      }

      await admin.createTopics({
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
      });
      logger.info(`✅ Topic created successfully: ${topic}`);
    } catch (error) {
      logger.error(`❌ Failed to create Kafka topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves or initializes the Kafka Producer client.
   */
  async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
      logger.info("✅ Kafka Producer connected");
    }
    return this.producer;
  }

  /**
   * Publishes a JSON message to a specific Kafka topic.
   * @param topic - Target topic
   * @param message - The object to be stringified and sent
   */
  async sendMessage(topic: string, message: any) {
    try {
      const producer = await this.getProducer();
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
      logger.info(`📤 Message sent to topic: ${topic}`);
    } catch (error) {
      logger.error("❌ Failed to send Kafka message:", error);
      throw error;
    }
  }

  /**
   * Helper to start a batch consumer on a topic.
   * Batch processing is more efficient for high-volume logs.
   */
  async listenBatch(topic: string, groupId: string, onBatch: any) {
    try {
      const consumer = this.kafka.consumer({ groupId });
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: true });
      await consumer.run({
        eachBatch: onBatch,
      });
      this.consumers.push(consumer);
      logger.info(`📡 Listening to Kafka topic (batch mode): ${topic}`);
    } catch (error) {
      logger.error(`❌ Failed to start Kafka batch consumer for topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Log Consumer:
   * Consumes real-time build logs, emits them to the server's event bus 
   * (for SSE), and persists them in batches to ClickHouse.
   */
  async initLogConsumer() {
    await this.listenBatch("container-logs", "api-server-logs-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
      const logEntries = [];
      const validMessages = [];

      // Process each message in the batch
      for (const message of batch.messages) {
        if (!message.value) continue;
        try {
          const data = JSON.parse(message.value.toString());
          // Prepare for ClickHouse bulk insertion
          logEntries.push({ event_id: uuidv4(), deployment_id: data.DEPLOYMENT_ID, log: data.log });
          // Notify any connected SSE clients
          eventBus.emit("log-received", data);
          validMessages.push(message);
        } catch (err) {
          logger.error(`❌ Kafka Log Consumer: Error parsing JSON: ${err}`);
          // Resolve offset even on error to avoid blocking the partition
          resolveOffset(message.offset);
        }
      }

      // Perform bulk insertion to ClickHouse to maintain high throughput
      if (logEntries.length > 0) {
        try {
          await clickHouseService.insert("log_events", logEntries);
          // Mark all processed messages as resolved
          for (const message of validMessages) {
            resolveOffset(message.offset);
          }
          logger.info(`📝 Log Consumer: Batched ${logEntries.length} logs to ClickHouse.`);
        } catch (err) {
          logger.error("❌ Kafka Log Consumer: ClickHouse Insertion Failed:", err);
          throw err; // Fail the batch to trigger retry if DB is down
        }
      }
      // Send heartbeat to prevent session timeout
      await heartbeat();
    });
  }

  /**
   * Status Consumer:
   * Listens for build completion events (READY/FAILED) and updates the Postgres DB.
   */
  async initStatusConsumer() {
    await this.listenBatch("deployment-status", "api-server-status-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
      for (const message of batch.messages) {
        if (!message.value) continue;
        try {
          const data = JSON.parse(message.value.toString());
          const { DEPLOYMENT_ID, status } = data;
          
          if (!status) {
              logger.warn(`⚠️ Status Consumer: Missing status for deployment ${DEPLOYMENT_ID}`);
              resolveOffset(message.offset);
              continue;
          }

          // Atomically update the deployment status in the main relational DB
          const res = await postgresService.query("UPDATE deployments SET status = $1 WHERE id = $2", [status, DEPLOYMENT_ID]);
          // Trigger SSE update for the dashboard deployment list
          eventBus.emit("deployment-status-changed");
          
          if (res.rowCount === 0) {
            logger.warn(`⚠️ Status Consumer: No deployment found with ID ${DEPLOYMENT_ID}`);
          } else {
            logger.info(`🔔 Status Consumer: Updated deployment ${DEPLOYMENT_ID} to ${status}`);
          }
          // Mark as processed
          resolveOffset(message.offset);
        } catch (err) {
          logger.error(`❌ Kafka Status Consumer Error: ${err}`);
          if (err instanceof SyntaxError) {
            resolveOffset(message.offset);
          } else {
            throw err; // Critical DB error should stop the consumer to prevent data loss
          }
        }
      }
      await heartbeat();
    });
  }

  /**
   * Gracefully shuts down all Kafka connections.
   */
  async disconnect() {
    if (this.producer) await this.producer.connect().then(() => this.producer?.disconnect());
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    if (this.admin) await this.admin.disconnect();
    logger.info("👋 Kafka disconnected");
  }
}

// Export a singleton instance of the Kafka service
export const kafkaService = new KafkaService();
export default kafkaService;
