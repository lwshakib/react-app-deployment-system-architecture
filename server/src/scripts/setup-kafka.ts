import { kafkaService } from "../services/kafka.service";

async function setupKafka() {
  console.log("🚀 Starting Kafka setup...");

  const TOPICS = ["container-logs", "deployment-status"];

  try {
    for (const topic of TOPICS) {
      await kafkaService.createTopic(topic);
      console.log(`✅ Kafka topic '${topic}' is ready.`);
    }
  } catch (error) {
    console.error("❌ Kafka setup failed:", error);
    process.exit(1);
  } finally {
    await kafkaService.disconnect();
  }
}

setupKafka().then(() => {
  process.exit(0);
});
