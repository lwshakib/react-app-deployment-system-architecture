import { Kafka, type Producer } from "kafkajs";
import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger.js";

class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private projectId: string;
  private deploymentId: string;

  constructor() {
    this.projectId = process.env.PROJECT_ID!;
    this.deploymentId = process.env.DEPLOYMENT_ID!;
    
    this.kafka = new Kafka({
      clientId: `docker-build-server-${this.deploymentId}`,
      brokers: [process.env.KAFKA_BROKER!],
      ssl: process.env.KAFKA_CA_CERT ? {
        ca: [process.env.KAFKA_CA_CERT],
      } : undefined,
      sasl: {
        username: process.env.KAFKA_USERNAME!,
        password: process.env.KAFKA_PASSWORD!,
        mechanism: "plain",
      },
    });

    this.producer = this.kafka.producer();
  }

  async connect() {
    try {
      await this.producer.connect();
      logger.info("✅ Kafka Producer connected");
    } catch (err) {
      logger.error("❌ Kafka Connection Error:", err);
      throw err;
    }
  }

  async disconnect() {
    try {
      await this.producer.disconnect();
      logger.info("✅ Kafka Producer disconnected");
    } catch (err) {
      logger.error("❌ Error disconnecting Kafka Producer:", err);
    }
  }

  async publishLog(log: string) {
    logger.debug(`📤 Log: ${log}`);
    try {
      await this.producer.send({
        topic: "container-logs",
        messages: [
          {
            key: "log",
            value: JSON.stringify({ 
              PROJECT_ID: this.projectId, 
              DEPLOYMENT_ID: this.deploymentId, 
              log 
            }),
          },
        ],
      });
    } catch (err) {
      logger.error("❌ Failed to publish log to Kafka:", err);
    }
  }

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

export const kafkaService = new KafkaService();
