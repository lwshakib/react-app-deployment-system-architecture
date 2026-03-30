import { Kafka } from "kafkajs";
import logger from "../logger/winston.logger";
import { KAFKA_BROKER, KAFKA_CA_CERT, KAFKA_CLIENT_ID, KAFKA_PASSWORD, KAFKA_USERNAME } from "../envs";

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

async function resetKafka() {
  logger.info("🔥 Resetting Kafka topics...");

  const admin = kafka.admin();
  try {
    await admin.connect();
    const TOPICS = ["container-logs", "deployment-status"];
    const existingTopics = await admin.listTopics();
    
    for (const topic of TOPICS) {
      if (existingTopics.includes(topic)) {
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
    await admin.disconnect();
  }
}

resetKafka().then(() => {
  process.exit(0);
});
