/**
 * Kafka Infrastructure Reset Script.
 * This script connects to the Kafka broker and deletes the topics used for 
 * log streaming and deployment status updates to ensure a clean slate.
 */

import { Kafka } from "kafkajs";
import logger from "../logger/winston.logger";
import { KAFKA_BROKER, KAFKA_CA_CERT, KAFKA_CLIENT_ID, KAFKA_PASSWORD, KAFKA_USERNAME } from "../envs";

/**
 * Global Kafka Client Configuration.
 * Note: SSL and SASL (Plain) are used to securely communicate with managed clusters.
 */
const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: [KAFKA_BROKER],
  ssl: KAFKA_CA_CERT ? { ca: [KAFKA_CA_CERT] } : undefined,
  sasl: {
    mechanism: "plain",
    username: KAFKA_USERNAME,
    password: KAFKA_PASSWORD,
  },
});

/**
 * Main Reset function for Kafka.
 */
async function resetKafka() {
  logger.info("🔥 Resetting Kafka topics...");

  const admin = kafka.admin();
  try {
    // 1. Establish administrative connection to the cluster
    await admin.connect();
    
    const TOPICS = ["container-logs", "deployment-status"];
    // 2. Fetch all existing topics to verify what needs to be deleted
    const existingTopics = await admin.listTopics();
    
    for (const topic of TOPICS) {
      if (existingTopics.includes(topic)) {
        // 3. Delete the topic if it exists
        await admin.deleteTopics({ topics: [topic] });
        logger.info(`✅ Kafka topic '${topic}' deleted successfully.`);
      } else {
        logger.info(`ℹ️ Topic '${topic}' does not exist, skipping.`);
      }
    }
  } catch (error) {
    logger.error("❌ Kafka reset failed:", error);
    process.exit(1);
  } finally {
    // 4. Always disconnect the admin client to free up resources
    await admin.disconnect();
  }
}

resetKafka().then(() => {
  process.exit(0);
});
