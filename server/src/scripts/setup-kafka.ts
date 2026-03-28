import { kafkaService } from "../services/kafka.service";

async function setupKafka() {
  console.log("🚀 Starting Kafka setup...");

  const TOPIC = "container-logs";

  try {
    await kafkaService.createTopic(TOPIC);
    console.log(`✅ Kafka topic '${TOPIC}' is ready.`);
  } catch (error) {
    console.error("❌ Kafka setup failed:", error);
    process.exit(1);
  } finally {
    await kafkaService.disconnect();
  }
}

setupKafka();
