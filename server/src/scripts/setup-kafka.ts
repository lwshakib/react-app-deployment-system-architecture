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

async function setupKafka() {
  logger.info("🚀 Starting Kafka setup...");

  const admin = kafka.admin();
  try {
    await admin.connect();
    const TOPICS = ["container-logs", "deployment-status"];
    await admin.createTopics({
      topics: TOPICS.map((topic) => ({ topic })),
    });
    logger.info("✅ Kafka topics are ready.");
  } catch (error) {
    logger.error("❌ Kafka setup failed:", error);
    process.exit(1);
  } finally {
    await admin.disconnect();
  }
}

setupKafka().then(() => {
  process.exit(0);
});
