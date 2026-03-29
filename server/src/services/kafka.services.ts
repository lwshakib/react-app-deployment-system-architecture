import { Kafka, Producer, Consumer, Admin } from "kafkajs";
import { v4 as uuidv4 } from "uuid";
import logger from "../logger/winston.logger";
import clickHouseService from "./clickhouse.services";
import postgresService from "./postgres.services";
import eventBus from "./event-bus.services";

class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Consumer[] = [];
  private admin: Admin | null = null;

  constructor() {
    const broker = process.env.KAFKA_BROKER;
    const username = process.env.KAFKA_USERNAME;
    const password = process.env.KAFKA_PASSWORD;
    const clientId = process.env.KAFKA_CLIENT_ID;
    const caCert = process.env.KAFKA_CA_CERT;

    if (!broker || !username || !password || !clientId) {
      throw new Error("❌ Kafka environment variables (KAFKA_BROKER, KAFKA_USERNAME, KAFKA_PASSWORD, KAFKA_CLIENT_ID) are missing. Infrastructure cannot be initialized.");
    }

    this.kafka = new Kafka({
      clientId,
      brokers: [broker],
      ssl: caCert ? {
        ca: [caCert],
      } : undefined,
      sasl: {
        mechanism: "plain",
        username,
        password,
      },
    });
  }

  /**
   * Initialize the admin client
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
   * Create a topic if it doesn't exist
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
   * Initialize the producer
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
   * Send a message to a topic
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
   * Listen to a topic in batches
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
   * Initialize the log consumer
   */
  async initLogConsumer() {
    await this.listenBatch("container-logs", "api-server-logs-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
      const logEntries = [];
      const validMessages = [];

      for (const message of batch.messages) {
        if (!message.value) continue;
        try {
          const data = JSON.parse(message.value.toString());
          logEntries.push({ event_id: uuidv4(), deployment_id: data.DEPLOYMENT_ID, log: data.log });
          eventBus.emit("log-received", data);
          validMessages.push(message);
        } catch (err) {
          logger.error(`❌ Kafka Log Consumer: Error parsing JSON: ${err} ${message.value.toString()}`);
          resolveOffset(message.offset);
        }
      }

      if (logEntries.length > 0) {
        try {
          await clickHouseService.insert("log_events", logEntries);
          for (const message of validMessages) {
            resolveOffset(message.offset);
          }
          logger.info(`📝 Log Consumer: Batched ${logEntries.length} logs to ClickHouse.`);
        } catch (err) {
          logger.error("❌ Kafka Log Consumer: ClickHouse Insertion Failed:", err);
          throw err;
        }
      }
      await heartbeat();
    });
  }

  /**
   * Initialize the status consumer
   */
  async initStatusConsumer() {
    await this.listenBatch("deployment-status", "api-server-status-consumer", async ({ batch, heartbeat, resolveOffset }: any) => {
      for (const message of batch.messages) {
        if (!message.value) continue;
        try {
          const payload = message.value.toString();
          const data = JSON.parse(payload);
          const { DEPLOYMENT_ID, status } = data;
          
          if (!status) {
              logger.warn(`⚠️ Status Consumer: Received message without status for deployment ${DEPLOYMENT_ID}. Skipping DB update.`);
              resolveOffset(message.offset);
              continue;
          }

          const res = await postgresService.query("UPDATE deployments SET status = $1 WHERE id = $2", [status, DEPLOYMENT_ID]);
          eventBus.emit("deployment-status-changed");
          
          if (res.rowCount === 0) {
            logger.warn(`⚠️ Status Consumer: No deployment found with ID ${DEPLOYMENT_ID}`);
          } else {
            logger.info(`🔔 Status Consumer: Updated deployment ${DEPLOYMENT_ID} to ${status}`);
          }
          resolveOffset(message.offset);
        } catch (err) {
          logger.error(`❌ Kafka Status Consumer Error: ${err} ${message.value?.toString()}`);
          if (err instanceof SyntaxError) {
            resolveOffset(message.offset);
          } else {
            throw err;
          }
        }
      }
      await heartbeat();
    });
  }

  /**
   * Disconnect producer and consumer
   */
  async disconnect() {
    if (this.producer) await this.producer.disconnect();
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    if (this.admin) await this.admin.disconnect();
    logger.info("👋 Kafka disconnected");
  }
}

// Export a singleton instance
export const kafkaService = new KafkaService();
export default kafkaService;
