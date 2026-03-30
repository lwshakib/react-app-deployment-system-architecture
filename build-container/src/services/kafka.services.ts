import { Kafka, type Producer } from "kafkajs";
import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger.js";
import { DEPLOYMENT_ID, KAFKA_BROKER, KAFKA_CA_CERT, KAFKA_PASSWORD, KAFKA_USERNAME, PROJECT_ID } from "../envs";

class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private projectId: string;
  private deploymentId: string;

  constructor() {
    this.projectId = PROJECT_ID;
    this.deploymentId = DEPLOYMENT_ID;
    
    this.kafka = new Kafka({
      clientId: `docker-build-server-${this.deploymentId}`,
      brokers: [KAFKA_BROKER],
      ssl: KAFKA_CA_CERT ? {
        ca: [KAFKA_CA_CERT],
      } : undefined,
      sasl: {
        username: KAFKA_USERNAME,
        password: KAFKA_PASSWORD,
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
