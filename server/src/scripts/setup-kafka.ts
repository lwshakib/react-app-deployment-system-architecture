/**
 * Kafka Infrastructure Setup Script.
 * This script connects to the Kafka broker and ensures that the required topics 
 * for log streaming and deployment status updates are created and ready for use.
 */

import { Kafka } from "kafkajs";
import logger from "../logger/winston.logger";
import { KAFKA_BROKER, KAFKA_CA_CERT, KAFKA_CLIENT_ID, KAFKA_PASSWORD, KAFKA_USERNAME } from "../envs";

/**
 * Global Kafka Client Configuration.
 * Note: SSL and SASL (Plain) are used to securely communicate with managed clusters (e.g., Aiven, Upstash).
 */
const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: [KAFKA_BROKER],
  ssl: KAFKA_CA_CERT ? { ca: [KAFKA_CA_CERT] } : undefined, // Optional CA for secure connections
  sasl: {
    mechanism: "plain",
    username: KAFKA_USERNAME,
    password: KAFKA_PASSWORD,
  },
});

/**
 * Main Setup function for Kafka.
 */
async function setupKafka() {
  logger.info("🚀 Starting Kafka setup...");

  const admin = kafka.admin();
  try {
    // 1. Establish administrative connection to the cluster
    await admin.connect();
    
    // 2. Define the topics required by the system
    const TOPICS = ["container-logs", "deployment-status"];
    
    // 3. Create topics if they don't already exist
    await admin.createTopics({
      topics: TOPICS.map((topic) => ({ topic })),
    });
    
    logger.info("✅ Kafka topics are ready.");
  } catch (error) {
    logger.error("❌ Kafka setup failed:", error);
    process.exit(1);
  } finally {
    // 4. Always disconnect the admin client to free up resources
    await admin.disconnect();
  }
}

setupKafka().then(() => {
  process.exit(0);
});
