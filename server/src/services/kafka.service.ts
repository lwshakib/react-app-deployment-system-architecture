import { Kafka, Producer, Consumer, Admin } from "kafkajs";
import fs from "fs";
import path from "path";

class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private admin: Admin | null = null;

  constructor() {
    const broker = process.env.KAFKA_BROKER;
    const username = process.env.KAFKA_USERNAME;
    const password = process.env.KAFKA_PASSWORD;
    const clientId = process.env.KAFKA_CLIENT_ID;
    const caFile = process.env.KAFKA_CA_FILE;

    if (!broker || !username || !password || !clientId) {
      throw new Error("❌ Kafka environment variables (KAFKA_BROKER, KAFKA_USERNAME, KAFKA_PASSWORD, KAFKA_CLIENT_ID) are missing. Infrastructure cannot be initialized.");
    }

    this.kafka = new Kafka({
      clientId,
      brokers: [broker],
      ssl: caFile ? {
        ca: [fs.readFileSync(path.isAbsolute(caFile) ? caFile : path.join(process.cwd(), caFile), "utf-8")],
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
      console.log("✅ Kafka Admin connected");
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
        console.log(`ℹ️ Topic already exists: ${topic}`);
        return;
      }

      await admin.createTopics({
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
      });
      console.log(`✅ Topic created successfully: ${topic}`);
    } catch (error) {
      console.error(`❌ Failed to create Kafka topic ${topic}:`, error);
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
      console.log("✅ Kafka Producer connected");
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
      console.log(`📤 Message sent to topic: ${topic}`);
    } catch (error) {
      console.error("❌ Failed to send Kafka message:", error);
      throw error;
    }
  }

  /**
   * Listen to a topic in batches
   */
  async listenBatch(topic: string, groupId: string, onBatch: any) {
    try {
      this.consumer = this.kafka.consumer({ groupId });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic, fromBeginning: true });
      await this.consumer.run({
        eachBatch: onBatch,
      });
      console.log(`📡 Listening to Kafka topic (batch mode): ${topic}`);
    } catch (error) {
      console.error("❌ Failed to start Kafka batch consumer:", error);
      throw error;
    }
  }

  /**
   * Disconnect producer and consumer
   */
  async disconnect() {
    if (this.producer) await this.producer.disconnect();
    if (this.consumer) await this.consumer.disconnect();
    console.log("👋 Kafka disconnected");
  }
}

// Export a singleton instance
export const kafkaService = new KafkaService();
export default kafkaService;
