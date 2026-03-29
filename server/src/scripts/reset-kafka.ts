import { kafkaService } from "../services/kafka.services";
import logger from "../logger/winston.logger";

async function resetKafka() {
  logger.info("🔥 Resetting Kafka topics...");

  const TOPICS = ["container-logs", "deployment-status"];

  try {
    const admin = await kafkaService.getAdmin();
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
    await kafkaService.disconnect();
  }
}

resetKafka().then(() => {
  process.exit(0);
});
