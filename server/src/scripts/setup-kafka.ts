import { kafkaService } from "../services/kafka.services";
import logger from "../logger/winston.logger";

async function setupKafka() {
  logger.info("🚀 Starting Kafka setup...");

  const TOPICS = ["container-logs", "deployment-status"];

  try {
    for (const topic of TOPICS) {
      await kafkaService.createTopic(topic);
      logger.info(`✅ Kafka topic '${topic}' is ready.`);
    }
  } catch (error) {
    logger.error("❌ Kafka setup failed:", error);
    process.exit(1);
  } finally {
    await kafkaService.disconnect();
  }
}

setupKafka().then(() => {
  process.exit(0);
});
